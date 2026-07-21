/**
 * 日志分析服务
 *
 * 接收来自 IPC 服务器的原始消息，进行以下处理：
 *   1. 将原始 IPC 消息转换为结构化的 LogEntry
 *   2. 关联请求和响应，计算耗时
 *   3. 维护内存中的日志缓冲区（环形缓冲）
 *   4. 检测常见错误模式
 *   5. 通过事件通知 UI 更新
 */
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { CallRecord, JsonRpcError, LogEntry, LogEntryType } from '../models/logEntry';
import { IpcMessage } from './ipcServer';
import { appendLine, ensureDir } from '../utils/fs';
import { getDebuggerDir } from '../utils/platform';

/** LogAnalyzer 事件 */
export interface LogAnalyzerEvents {
  /** 新日志条目 */
  log: (entry: LogEntry) => void;
  /** 新的调用记录（请求+响应配对完成） */
  call: (record: CallRecord) => void;
  /** 检测到错误 */
  error: (entry: LogEntry, diagnosis: string) => void;
  /** 缓冲区已清空 */
  cleared: () => void;
}

/** 常见错误模式诊断规则 */
interface ErrorPattern {
  /** 匹配条件 */
  match: (error: JsonRpcError, stderr?: string) => boolean;
  /** 诊断说明 */
  diagnose: (error: JsonRpcError) => string;
}

/** 错误模式库（按优先级排序，code 匹配优先） */
const ERROR_PATTERNS: ErrorPattern[] = [
  {
    match: (err) => err.code === -32601,
    diagnose: () => '方法不存在：Server 不支持此方法，可能是版本不兼容或能力声明不匹配。'
  },
  {
    match: (err) => err.code === -32602,
    diagnose: () => '参数错误：请检查传入参数的类型和格式是否符合 Schema 定义。'
  },
  {
    match: (err) => err.code === -32603,
    diagnose: () => '内部错误：Server 端发生异常，请查看 stderr 日志获取详细信息。'
  },
  {
    match: (err) => err.message.toLowerCase().includes('token') || err.message.toLowerCase().includes('unauthorized'),
    diagnose: (err) => `认证失败：${err.message}。请检查 API Token / 密钥是否配置正确，是否已过期。`
  },
  {
    match: (err) => err.message.toLowerCase().includes('connect') || err.message.toLowerCase().includes('econnrefused'),
    diagnose: (err) => `连接失败：${err.message}。请检查目标服务是否在运行，网络是否可达。`
  },
  {
    match: (err) => err.message.toLowerCase().includes('timeout') || err.message.toLowerCase().includes('timed out'),
    diagnose: (err) => `请求超时：${err.message}。可能原因：服务端响应过慢、网络延迟、或死循环。`
  },
  {
    match: (err) => err.message.toLowerCase().includes('not found') || err.message.toLowerCase().includes('enoent'),
    diagnose: (err) => `资源未找到：${err.message}。请检查路径、文件、或工具名是否存在。`
  },
  {
    match: (err) => err.message.toLowerCase().includes('permission') || err.message.toLowerCase().includes('eacces'),
    diagnose: (err) => `权限不足：${err.message}。请检查文件/目录权限，或是否需要管理员权限。`
  }
];

/** 最大缓冲区大小（条数） */
const MAX_BUFFER_SIZE = 5000;

/** 获取今日日志文件路径 */
function getTodayLogPath(): string {
  const today = new Date().toISOString().split('T')[0];
  return path.join(getDebuggerDir(), 'logs', `${today}.jsonl`);
}

/**
 * 日志分析器
 */
export class LogAnalyzer extends EventEmitter {
  /** 日志缓冲区（环形缓冲） */
  private logBuffer: LogEntry[] = [];
  /** 调用记录缓冲区 */
  private callBuffer: CallRecord[] = [];
  /** 待响应的请求（key: `${serverName}:${id}`） */
  private pendingRequests: Map<string, { method: string; start: number; params: unknown }> =
    new Map();
  /** 统计信息 */
  private stats = {
    totalMessages: 0,
    totalRequests: 0,
    totalResponses: 0,
    totalErrors: 0,
    totalNotifications: 0
  };

  /** 处理来自 IPC 的消息 */
  processMessage(ipcMsg: IpcMessage): void {
    this.stats.totalMessages++;

    // 根据消息类型创建 LogEntry
    const entry = this.createLogEntry(ipcMsg);
    if (!entry) {
      return;
    }

    // 更新统计
    this.updateStats(entry);

    // 添加到缓冲区
    this.addToBuffer(entry);

    // 关联请求和响应
    this.correlateCall(entry);

    // 持久化到文件
    this.persistLog(entry);

    // 发出事件
    this.emit('log', entry);

    // 错误诊断
    if (entry.type === 'response' && entry.error) {
      const diagnosis = this.diagnoseError(entry.error);
      this.emit('error', entry, diagnosis);
    }
  }

  /** 创建 LogEntry */
  private createLogEntry(ipcMsg: IpcMessage): LogEntry | null {
    const base = {
      entryId: uuidv4(),
      timestamp: ipcMsg.timestamp,
      serverName: ipcMsg.serverName,
      host: ipcMsg.serverName,
      jsonrpc: '2.0' as const
    };

    switch (ipcMsg.type) {
      case 'request':
        return {
          ...base,
          type: 'request' as LogEntryType,
          id: ipcMsg.data.id,
          method: ipcMsg.data.method || ipcMsg.data.method_name,
          params: ipcMsg.data.params,
          size: ipcMsg.data.size
        };

      case 'response':
        return {
          ...base,
          type: 'response' as LogEntryType,
          id: ipcMsg.data.id,
          method: ipcMsg.data.method || ipcMsg.data.method_name,
          result: ipcMsg.data.result,
          error: ipcMsg.data.error,
          duration: ipcMsg.data.duration,
          size: ipcMsg.data.size
        };

      case 'notification':
        return {
          ...base,
          type: 'notification' as LogEntryType,
          method: ipcMsg.data.method || ipcMsg.data.method_name,
          params: ipcMsg.data.params,
          size: ipcMsg.data.size
        };

      case 'stderr':
        return {
          ...base,
          type: 'stderr' as LogEntryType,
          method: 'stderr',
          params: ipcMsg.data
        };

      case 'system':
        return {
          ...base,
          type: 'system' as LogEntryType,
          method: 'system',
          params: ipcMsg.data
        };

      default:
        return null;
    }
  }

  /** 更新统计信息 */
  private updateStats(entry: LogEntry): void {
    switch (entry.type) {
      case 'request':
        this.stats.totalRequests++;
        break;
      case 'response':
        this.stats.totalResponses++;
        if (entry.error) {
          this.stats.totalErrors++;
        }
        break;
      case 'notification':
        this.stats.totalNotifications++;
        break;
    }
  }

  /** 添加到缓冲区（环形） */
  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    if (this.logBuffer.length > MAX_BUFFER_SIZE) {
      this.logBuffer.shift();
    }
  }

  /** 关联请求和响应 */
  private correlateCall(entry: LogEntry): void {
    if (entry.type === 'request' && entry.id !== undefined && entry.method) {
      const key = `${entry.serverName}:${entry.id}`;
      this.pendingRequests.set(key, {
        method: entry.method,
        start: new Date(entry.timestamp).getTime(),
        params: entry.params
      });
    } else if (entry.type === 'response' && entry.id !== undefined) {
      const key = `${entry.serverName}:${entry.id}`;
      const pending = this.pendingRequests.get(key);
      if (pending) {
        const record: CallRecord = {
          id: entry.id,
          server: entry.serverName,
          method: pending.method,
          startTime: pending.start,
          endTime: new Date(entry.timestamp).getTime(),
          duration: entry.duration,
          request: pending.params,
          response: entry.result,
          error: entry.error,
          status: entry.error ? 'error' : 'success'
        };
        this.callBuffer.push(record);
        if (this.callBuffer.length > MAX_BUFFER_SIZE) {
          this.callBuffer.shift();
        }
        this.pendingRequests.delete(key);
        this.emit('call', record);
      }
    }
  }

  /** 错误诊断 */
  private diagnoseError(error: JsonRpcError): string {
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.match(error)) {
        return pattern.diagnose(error);
      }
    }
    return `未分类错误（code=${error.code}）：${error.message}`;
  }

  /** 获取所有日志 */
  getLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  /** 获取所有调用记录 */
  getCalls(): CallRecord[] {
    return [...this.callBuffer];
  }

  /** 获取统计信息 */
  getStats() {
    return { ...this.stats };
  }

  /** 按条件过滤日志 */
  filterLogs(options: {
    serverName?: string;
    type?: LogEntryType;
    method?: string;
    since?: number;
  }): LogEntry[] {
    return this.logBuffer.filter((entry) => {
      if (options.serverName && entry.serverName !== options.serverName) return false;
      if (options.type && entry.type !== options.type) return false;
      if (options.method && entry.method !== options.method) return false;
      if (options.since && new Date(entry.timestamp).getTime() < options.since) return false;
      return true;
    });
  }

  /** 清空所有日志 */
  clear(): void {
    this.logBuffer = [];
    this.callBuffer = [];
    this.pendingRequests.clear();
    this.stats = {
      totalMessages: 0,
      totalRequests: 0,
      totalResponses: 0,
      totalErrors: 0,
      totalNotifications: 0
    };
    this.emit('cleared');
  }

  /** 持久化日志到文件 */
  private async persistLog(entry: LogEntry): Promise<void> {
    try {
      const logFile = getTodayLogPath();
      await ensureDir(path.dirname(logFile));
      await appendLine(logFile, JSON.stringify(entry));
    } catch (err) {
      // 持久化失败不应影响主流程，静默处理
      console.error('[MCP Debugger] 日志持久化失败:', err);
    }
  }

  /** 导出日志到指定路径 */
  async exportLogs(filePath: string): Promise<void> {
    const lines = this.logBuffer.map(e => JSON.stringify(e)).join('\n');
    await fs.promises.writeFile(filePath, lines + '\n', 'utf-8');
  }

  /** 获取今日日志文件路径 */
  getLogFilePath(): string {
    return getTodayLogPath();
  }
}
