/**
 * 日志条目数据模型
 *
 * 描述一次 MCP 通信的日志记录
 */

/** JSON-RPC 2.0 错误对象 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/** 日志条目类型 */
export type LogEntryType = 'request' | 'response' | 'notification' | 'stderr' | 'system';

/** 日志条目 */
export interface LogEntry {
  /** 日志条目 UUID */
  entryId: string;
  /** ISO 8601 时间戳 */
  timestamp: string;
  /** Server 名称 */
  serverName: string;
  /** Host 名称 */
  host: string;

  /** 消息类型 */
  type: LogEntryType;

  /** JSON-RPC 版本 */
  jsonrpc: '2.0';
  /** 请求/响应 ID（用于关联） */
  id?: number | string;
  /** 方法名（如 'tools/call'） */
  method?: string;
  /** 请求参数 */
  params?: unknown;
  /** 响应结果 */
  result?: unknown;
  /** 错误信息 */
  error?: JsonRpcError;

  /** 消息大小（字节） */
  size?: number;
  /** 响应耗时（毫秒，仅响应有） */
  duration?: number;
}

/** 调用记录（请求 + 响应的关联结果） */
export interface CallRecord {
  /** JSON-RPC id */
  id: number | string;
  /** Server 名称 */
  server: string;
  /** 方法名 */
  method: string;
  /** 开始时间戳（毫秒） */
  startTime: number;
  /** 结束时间戳（毫秒） */
  endTime?: number;
  /** 耗时（毫秒） */
  duration?: number;
  /** 请求参数 */
  request: unknown;
  /** 响应结果 */
  response?: unknown;
  /** 错误信息 */
  error?: JsonRpcError;
  /** 调用状态 */
  status: 'pending' | 'success' | 'error';
}
