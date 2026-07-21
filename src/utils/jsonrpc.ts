/**
 * JSON-RPC 2.0 消息解析工具
 *
 * MCP 协议基于 JSON-RPC 2.0，消息格式为：
 *   Content-Length: <length>\r\n\r\n<json-content>
 */

/** JSON-RPC 2.0 消息 */
export interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/** 解析结果 */
export interface ExtractedMessage {
  /** JSON 内容字符串 */
  content: string;
  /** 原始字节（含头部） */
  raw: Buffer;
  /** 剩余未解析的字节 */
  remaining: Buffer;
}

/** 消息头部分隔符 */
const HEADER_DELIMITER = '\r\n\r\n';
/** Content-Length 正则 */
const CONTENT_LENGTH_REGEX = /Content-Length:\s*(\d+)/i;

/**
 * 从缓冲区中提取一条完整的 JSON-RPC 消息
 *
 * @param buffer - 待解析的字节缓冲区
 * @returns 解析结果，如果没有完整消息则返回 null
 */
export function extractMessage(buffer: Buffer): ExtractedMessage | null {
  const headerEnd = buffer.indexOf(HEADER_DELIMITER);
  if (headerEnd === -1) {
    return null;
  }

  const header = buffer.subarray(0, headerEnd).toString('utf-8');
  const match = header.match(CONTENT_LENGTH_REGEX);
  if (!match) {
    return null;
  }

  const length = parseInt(match[1], 10);
  const messageStart = headerEnd + HEADER_DELIMITER.length;
  const messageEnd = messageStart + length;

  if (buffer.length < messageEnd) {
    return null;
  }

  return {
    content: buffer.subarray(messageStart, messageEnd).toString('utf-8'),
    raw: buffer.subarray(0, messageEnd),
    remaining: buffer.subarray(messageEnd)
  };
}

/**
 * 解析 JSON 字符串为 JsonRpcMessage
 *
 * @param content - JSON 字符串
 * @returns 解析后的消息，解析失败返回 null
 */
export function parseJsonRpc(content: string): JsonRpcMessage | null {
  try {
    return JSON.parse(content) as JsonRpcMessage;
  } catch {
    return null;
  }
}

/**
 * 判断消息是否为请求（有 id 和 method）
 */
export function isRequest(msg: JsonRpcMessage): boolean {
  return msg.id !== undefined && msg.method !== undefined;
}

/**
 * 判断消息是否为响应（有 id，无 method）
 */
export function isResponse(msg: JsonRpcMessage): boolean {
  return msg.id !== undefined && msg.method === undefined;
}

/**
 * 判断消息是否为通知（无 id，有 method）
 */
export function isNotification(msg: JsonRpcMessage): boolean {
  return msg.id === undefined && msg.method !== undefined;
}

/**
 * 判断响应是否为错误响应
 */
export function isErrorResponse(msg: JsonRpcMessage): boolean {
  return isResponse(msg) && msg.error !== undefined;
}

/**
 * 将 JsonRpcMessage 序列化为带 Content-Length 头的字节流
 *
 * @param msg - JSON-RPC 消息对象
 * @returns 序列化后的字节流
 */
export function serializeMessage(msg: JsonRpcMessage): Buffer {
  const json = JSON.stringify(msg);
  const header = `Content-Length: ${Buffer.byteLength(json, 'utf-8')}\r\n\r\n`;
  return Buffer.concat([Buffer.from(header, 'utf-8'), Buffer.from(json, 'utf-8')]);
}
