/**
 * JSON-RPC 解析器单元测试
 */
import {
  extractMessage,
  isErrorResponse,
  isNotification,
  isRequest,
  isResponse,
  parseJsonRpc,
  serializeMessage
} from '../../../src/utils/jsonrpc';

describe('JSON-RPC 解析器', () => {
  describe('extractMessage', () => {
    it('应正确提取完整消息', () => {
      const content = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'test' });
      const header = `Content-Length: ${Buffer.byteLength(content, 'utf-8')}\r\n\r\n`;
      const buffer = Buffer.from(header + content, 'utf-8');

      const result = extractMessage(buffer);
      expect(result).not.toBeNull();
      expect(result!.content).toBe(content);
      expect(result!.remaining.length).toBe(0);
    });

    it('消息不完整时应返回 null', () => {
      const content = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'test' });
      const header = `Content-Length: ${Buffer.byteLength(content, 'utf-8')}\r\n\r\n`;
      // 只发头部，不发内容
      const buffer = Buffer.from(header, 'utf-8');

      const result = extractMessage(buffer);
      expect(result).toBeNull();
    });

    it('应正确处理多条消息', () => {
      const msg1 = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'test1' });
      const msg2 = JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'test2' });

      const part1 = `Content-Length: ${Buffer.byteLength(msg1)}\r\n\r\n${msg1}`;
      const part2 = `Content-Length: ${Buffer.byteLength(msg2)}\r\n\r\n${msg2}`;

      const buffer = Buffer.from(part1 + part2, 'utf-8');

      const result1 = extractMessage(buffer);
      expect(result1).not.toBeNull();
      expect(JSON.parse(result1!.content).id).toBe(1);

      const result2 = extractMessage(result1!.remaining);
      expect(result2).not.toBeNull();
      expect(JSON.parse(result2!.content).id).toBe(2);
      expect(result2!.remaining.length).toBe(0);
    });
  });

  describe('parseJsonRpc', () => {
    it('应正确解析有效 JSON', () => {
      const content = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'test', params: { a: 1 } });
      const msg = parseJsonRpc(content);
      expect(msg).not.toBeNull();
      expect(msg!.jsonrpc).toBe('2.0');
      expect(msg!.id).toBe(1);
      expect(msg!.method).toBe('test');
    });

    it('应处理无效 JSON', () => {
      const msg = parseJsonRpc('{invalid json');
      expect(msg).toBeNull();
    });
  });

  describe('消息类型判断', () => {
    it('isRequest 应正确识别请求', () => {
      expect(isRequest({ jsonrpc: '2.0', id: 1, method: 'test' })).toBe(true);
      expect(isRequest({ jsonrpc: '2.0', method: 'test' })).toBe(false); // 无 id
      expect(isRequest({ jsonrpc: '2.0', id: 1, result: {} })).toBe(false); // 无 method
    });

    it('isResponse 应正确识别响应', () => {
      expect(isResponse({ jsonrpc: '2.0', id: 1, result: {} })).toBe(true);
      expect(isResponse({ jsonrpc: '2.0', id: 1, method: 'test' })).toBe(false);
    });

    it('isNotification 应正确识别通知', () => {
      expect(isNotification({ jsonrpc: '2.0', method: 'notify' })).toBe(true);
      expect(isNotification({ jsonrpc: '2.0', id: 1, method: 'test' })).toBe(false);
    });

    it('isErrorResponse 应正确识别错误响应', () => {
      expect(
        isErrorResponse({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -1, message: 'fail' }
        })
      ).toBe(true);
      expect(isErrorResponse({ jsonrpc: '2.0', id: 1, result: {} })).toBe(false);
    });
  });

  describe('serializeMessage', () => {
    it('应正确序列化为带 Content-Length 头的消息', () => {
      const msg = { jsonrpc: '2.0' as const, id: 1, method: 'test' };
      const buffer = serializeMessage(msg);
      const str = buffer.toString('utf-8');

      expect(str).toContain('Content-Length:');
      expect(str).toContain('\r\n\r\n');
      expect(str).toContain('"method":"test"');

      // 反向解析验证
      const extracted = extractMessage(buffer);
      expect(extracted).not.toBeNull();
      const parsed = parseJsonRpc(extracted!.content);
      expect(parsed!.method).toBe('test');
    });
  });
});
