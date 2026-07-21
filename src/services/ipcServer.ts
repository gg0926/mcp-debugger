/**
 * IPC 通信服务
 *
 * 在扩展端创建 IPC 服务器，接收来自 Wrapper 进程的日志消息。
 *
 * 通信协议：
 *   - 传输层：Unix Domain Socket (Linux/Mac) 或 Named Pipe (Windows)
 *   - 消息格式：每行一个 JSON 对象（以 \n 分隔）
 *
 * 工作流程：
 *   1. 扩展启动时创建 IPC 服务器，监听管道路径
 *   2. Wrapper 进程通过管道路径连接到服务器
 *   3. Wrapper 将拦截的日志通过管道发送到扩展
 *   4. 扩展解析消息并交给 LogAnalyzer 处理
 */
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

/** IPC 消息类型 */
export type IpcMessageType =
  'log' | 'request' | 'response' | 'notification' | 'stderr' | 'system' | 'error';

/** IPC 消息（来自 Wrapper） */
export interface IpcMessage {
  type: IpcMessageType;
  serverName: string;
  timestamp: string;
  data: {
    method?: string;
    direction?: 'request' | 'response';
    id?: number | string;
    method_name?: string;
    params?: unknown;
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
    duration?: number;
    size?: number;
    [key: string]: unknown;
  };
}

/** IPC 服务器事件 */
export interface IpcServerEvents {
  /** 收到新消息 */
  message: (msg: IpcMessage) => void;
  /** Wrapper 连接 */
  connected: (serverName: string) => void;
  /** Wrapper 断开 */
  disconnected: (serverName: string) => void;
  /** 服务器错误 */
  error: (err: Error) => void;
}

/**
 * IPC 服务器
 *
 * 基于 Node.js net 模块实现，使用 Named Pipe / Unix Domain Socket
 */
export class IpcServer extends EventEmitter {
  private server: net.Server | null = null;
  private pipePath: string;
  private clients: Map<string, net.Socket> = new Map();
  private isRunning = false;

  constructor() {
    super();
    this.pipePath = this.generatePipePath();
  }

  /** 生成唯一的管道路径 */
  private generatePipePath(): string {
    const id = uuidv4().slice(0, 8);
    if (process.platform === 'win32') {
      // Windows: \\.\pipe\name
      return `\\\\.\\pipe\\mcp-debugger-${id}`;
    }
    // Unix: /tmp/mcp-debugger-xxx.sock
    return path.join(os.tmpdir(), `mcp-debugger-${id}.sock`);
  }

  /** 获取管道路径（用于传给 Wrapper） */
  getPipePath(): string {
    return this.pipePath;
  }

  /** 启动 IPC 服务器 */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (err) => {
        this.emit('error', err);
        if (!this.isRunning) {
          reject(err);
        }
      });

      // 先清理可能存在的旧管道文件（Unix）
      if (process.platform !== 'win32') {
        try {
          fs.unlinkSync(this.pipePath);
        } catch {
          // 文件不存在是正常的
        }
      }

      this.server.listen(this.pipePath, () => {
        this.isRunning = true;
        resolve();
      });
    });
  }

  /** 停止 IPC 服务器 */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      return;
    }

    // 关闭所有客户端连接
    for (const [, socket] of this.clients) {
      socket.end();
    }
    this.clients.clear();

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.isRunning = false;
        this.server = null;
        resolve();
      });
    });
  }

  /** 处理新的 Wrapper 连接 */
  private handleConnection(socket: net.Socket): void {
    let buffer = '';
    let clientName = 'unknown';

    socket.on('data', (data: Buffer) => {
      buffer += data.toString('utf-8');

      // 按行解析消息
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);

        if (!line) {
          continue;
        }

        try {
          const msg: IpcMessage = JSON.parse(line);
          // 用 serverName 作为客户端标识
          if (clientName === 'unknown' && msg.serverName) {
            clientName = msg.serverName;
            this.clients.set(clientName, socket);
            this.emit('connected', clientName);
          }
          this.emit('message', msg);
        } catch {
          // 忽略解析失败的消息
        }
      }
    });

    socket.on('close', () => {
      if (clientName !== 'unknown') {
        this.clients.delete(clientName);
        this.emit('disconnected', clientName);
      }
    });

    socket.on('error', () => {
      // socket 错误通常伴随 close 事件，这里不额外处理
    });
  }

  /** 是否正在运行 */
  get running(): boolean {
    return this.isRunning;
  }

  /** 获取当前连接的 Wrapper 列表 */
  getConnectedWrappers(): string[] {
    return Array.from(this.clients.keys());
  }
}
