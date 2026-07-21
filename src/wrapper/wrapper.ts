/**
 * MCP Server Wrapper - 核心消息拦截器
 *
 * 作为 Host 和真实 MCP Server 之间的中间层，拦截所有 stdio 通信，
 * 解析 JSON-RPC 2.0 消息并通过 IPC 发送到扩展进行展示。
 *
 * 工作原理：
 *   Host (stdin/stdout) ↔ Wrapper ↔ 真实 MCP Server (stdin/stdout)
 *
 * 启动参数：
 *   node wrapper.js <serverName> <ipcEndpoint> <originalCommand> [originalArgs...]
 *
 * 环境变量：
 *   MCP_DEBUGGER_PIPE - IPC 管道路径（可选，覆盖参数）
 */
import * as net from 'net';
import { ChildProcess, spawn } from 'child_process';
import {
  extractMessage,
  isErrorResponse,
  isNotification,
  isRequest,
  isResponse,
  JsonRpcMessage,
  parseJsonRpc
} from '../utils/jsonrpc';

/** Wrapper 配置 */
interface WrapperConfig {
  serverName: string;
  ipcEndpoint: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

/** IPC 消息类型 */
type IpcMessageType =
  'log' | 'status' | 'error' | 'stderr' | 'system' | 'request' | 'response' | 'notification';

/** IPC 消息 */
interface IpcMessage {
  type: IpcMessageType;
  serverName: string;
  timestamp: string;
  data: unknown;
}

/** 从命令行参数解析配置 */
function parseArgs(argv: string[]): WrapperConfig {
  // argv[0] = node, argv[1] = wrapper.js, argv[2] = serverName, argv[3] = ipcEndpoint,
  // argv[4] = originalCommand, argv[5...] = originalArgs
  if (argv.length < 5) {
    process.stderr.write(
      'Usage: node wrapper.js <serverName> <ipcEndpoint> <originalCommand> [args...]\n'
    );
    process.exit(1);
  }

  const serverName = argv[2];
  const ipcEndpoint = process.env.MCP_DEBUGGER_PIPE || argv[3];
  const command = argv[4];
  const args = argv.slice(5);

  return {
    serverName,
    ipcEndpoint,
    command,
    args
  };
}

/**
 * MCP Server Wrapper
 */
class McpServerWrapper {
  private config: WrapperConfig;
  private serverProcess: ChildProcess | null = null;
  private ipcClient: net.Socket | null = null;
  private ipcConnected = false;
  private inputBuffer: Buffer = Buffer.alloc(0);
  private outputBuffer: Buffer = Buffer.alloc(0);
  private pendingRequests: Map<string | number, { method: string; start: number }> = new Map();
  private startTime: number;

  constructor(config: WrapperConfig) {
    this.config = config;
    this.startTime = Date.now();
  }

  /** 启动 Wrapper */
  async start(): Promise<void> {
    this.log('system', 'Wrapper starting', {
      serverName: this.config.serverName,
      command: this.config.command,
      args: this.config.args
    });

    // 1. 连接 IPC
    await this.connectIpc();

    // 2. 启动真实 MCP Server
    await this.spawnServer();

    // 3. 设置 stdin 转发（Host -> Server）
    this.setupStdinForwarding();

    // 4. 注册退出处理
    this.setupExitHandlers();

    this.log('system', 'Wrapper started successfully', {
      pid: this.serverProcess?.pid,
      uptime: Date.now() - this.startTime
    });
  }

  /** 连接 IPC 服务器 */
  private connectIpc(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`IPC connection timeout to ${this.config.ipcEndpoint}`));
      }, 5000);

      this.ipcClient = net.createConnection(this.config.ipcEndpoint, () => {
        clearTimeout(timeout);
        this.ipcConnected = true;
        this.log('system', 'IPC connected', { endpoint: this.config.ipcEndpoint });
        resolve();
      });

      this.ipcClient.on('error', (err) => {
        clearTimeout(timeout);
        if (!this.ipcConnected) {
          reject(new Error(`IPC connection failed: ${err.message}`));
        } else {
          this.log('error', 'IPC error', { message: err.message });
        }
      });

      this.ipcClient.on('close', () => {
        this.ipcConnected = false;
        this.log('system', 'IPC disconnected', {});
      });
    });
  }

  /** 启动真实 MCP Server */
  private spawnServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server spawn timeout'));
      }, 10000);

      try {
        this.serverProcess = spawn(this.config.command, this.config.args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, ...this.config.env },
          cwd: this.config.cwd
        });

        clearTimeout(timeout);

        if (!this.serverProcess.stdin || !this.serverProcess.stdout || !this.serverProcess.stderr) {
          reject(new Error('Failed to get server stdio streams'));
          return;
        }

        // 处理 Server stdout（Server -> Host + 拦截）
        this.serverProcess.stdout.on('data', (data: Buffer) => {
          this.handleServerOutput(data);
        });

        // 处理 Server stderr
        this.serverProcess.stderr.on('data', (data: Buffer) => {
          this.handleServerStderr(data);
        });

        // 处理 Server 退出
        this.serverProcess.on('exit', (code, signal) => {
          this.log('system', 'Server exited', { code, signal });
          process.exit(code ?? 1);
        });

        this.serverProcess.on('error', (err) => {
          this.log('error', 'Server process error', { message: err.message });
          process.exit(1);
        });

        resolve();
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /** 设置 stdin 转发（Host -> Server） */
  private setupStdinForwarding(): void {
    process.stdin.on('data', (data: Buffer) => {
      this.handleHostInput(data);
    });

    process.stdin.on('end', () => {
      this.log('system', 'Host stdin ended', {});
      if (this.serverProcess?.stdin) {
        this.serverProcess.stdin.end();
      }
    });

    process.stdin.on('error', (err) => {
      this.log('error', 'Host stdin error', { message: err.message });
    });
  }

  /** 处理 Host 输入（Host -> Server 方向） */
  private handleHostInput(data: Buffer): void {
    if (this.serverProcess?.stdin?.writable) {
      this.serverProcess.stdin.write(data);
    }

    this.inputBuffer = Buffer.concat([this.inputBuffer, data]);
    this.parseMessages(this.inputBuffer, 'request', (remaining) => {
      this.inputBuffer = remaining;
    });
  }

  /** 处理 Server 输出（Server -> Host 方向） */
  private handleServerOutput(data: Buffer): void {
    process.stdout.write(data);

    this.outputBuffer = Buffer.concat([this.outputBuffer, data]);
    this.parseMessages(this.outputBuffer, 'response', (remaining) => {
      this.outputBuffer = remaining;
    });
  }

  /** 处理 Server stderr */
  private handleServerStderr(data: Buffer): void {
    const text = data.toString('utf-8');
    // stderr 直接转发给 Host
    process.stderr.write(data);
    // 同时记录到日志
    this.log('stderr', text, { serverName: this.config.serverName });
  }

  /** 从缓冲区解析所有完整消息 */
  private parseMessages(
    buffer: Buffer,
    direction: 'request' | 'response',
    onConsumed: (remaining: Buffer) => void
  ): void {
    let currentBuffer = buffer;
    let keepParsing = true;

    while (keepParsing) {
      const extracted = extractMessage(currentBuffer);
      if (!extracted) {
        keepParsing = false;
        break;
      }

      const msg = parseJsonRpc(extracted.content);
      if (msg) {
        this.processMessage(msg, direction);
      }

      currentBuffer = extracted.remaining;
    }

    onConsumed(currentBuffer);
  }

  /** 处理单条 JSON-RPC 消息 */
  private processMessage(msg: JsonRpcMessage, direction: 'request' | 'response'): void {
    const isReq = isRequest(msg);
    const isResp = isResponse(msg);
    const isNotif = isNotification(msg);
    const isError = isErrorResponse(msg);

    // 关联请求和响应，计算耗时
    if (isReq && msg.id !== undefined && msg.method) {
      this.pendingRequests.set(msg.id, { method: msg.method, start: Date.now() });
    }

    let duration: number | undefined;
    let method: string | undefined = msg.method;

    if (isResp && msg.id !== undefined) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        duration = Date.now() - pending.start;
        method = pending.method;
        this.pendingRequests.delete(msg.id);
      }
    }

    // 确定日志类型
    let logType: 'request' | 'response' | 'notification';
    if (isReq) {
      logType = 'request';
    } else if (isResp) {
      logType = isError ? 'response' : 'response';
    } else if (isNotif) {
      logType = 'notification';
    } else {
      logType = 'notification';
    }

    // 发送日志
    this.log(logType, method || 'unknown', {
      direction,
      id: msg.id,
      method: msg.method,
      params: msg.params,
      result: msg.result,
      error: msg.error,
      duration,
      size: JSON.stringify(msg).length
    });
  }

  /** 发送 IPC 消息 */
  private log(type: IpcMessageType, method: string, data: unknown): void {
    if (!this.ipcClient || !this.ipcConnected) {
      return;
    }

    const message: IpcMessage = {
      type,
      serverName: this.config.serverName,
      timestamp: new Date().toISOString(),
      data: {
        method,
        ...(typeof data === 'object' && data !== null ? data : { value: data })
      }
    };

    try {
      const json = JSON.stringify(message) + '\n';
      this.ipcClient.write(json);
    } catch (err) {
      // IPC 写入失败不影响主流程
      process.stderr.write(`[Wrapper] IPC write error: ${(err as Error).message}\n`);
    }
  }

  /** 设置退出处理 */
  private setupExitHandlers(): void {
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('exit', () => {
      if (this.serverProcess) {
        this.serverProcess.kill();
      }
    });
  }

  /** 关闭 Wrapper */
  private shutdown(signal: string): void {
    this.log('system', 'Wrapper shutting down', { signal });
    if (this.serverProcess) {
      this.serverProcess.kill(signal as NodeJS.Signals);
    }
    if (this.ipcClient) {
      this.ipcClient.end();
    }
    process.exit(0);
  }
}

// 启动 Wrapper
const config = parseArgs(process.argv);
const wrapper = new McpServerWrapper(config);
wrapper.start().catch((err) => {
  process.stderr.write(`[Wrapper] Failed to start: ${err.message}\n`);
  process.exit(1);
});
