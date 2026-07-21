/**
 * LogAnalyzer 单元测试
 */
import { LogAnalyzer } from '../../../src/services/logAnalyzer';
import { IpcMessage } from '../../../src/services/ipcServer';

describe('LogAnalyzer', () => {
  let analyzer: LogAnalyzer;

  beforeEach(() => {
    analyzer = new LogAnalyzer();
  });

  /** 创建请求 IPC 消息 */
  function makeRequest(serverName: string, id: number, method: string, params?: unknown): IpcMessage {
    return {
      type: 'request',
      serverName,
      timestamp: new Date().toISOString(),
      data: { method, id, params, size: 100 }
    };
  }

  /** 创建响应 IPC 消息 */
  function makeResponse(
    serverName: string,
    id: number,
    method: string,
    result?: unknown,
    error?: { code: number; message: string },
    duration?: number
  ): IpcMessage {
    return {
      type: 'response',
      serverName,
      timestamp: new Date().toISOString(),
      data: { method, id, result, error, duration, size: 100 }
    };
  }

  describe('基本消息处理', () => {
    it('应正确处理请求消息', () => {
      analyzer.processMessage(makeRequest('test-server', 1, 'tools/list'));

      const stats = analyzer.getStats();
      expect(stats.totalMessages).toBe(1);
      expect(stats.totalRequests).toBe(1);
      expect(stats.totalResponses).toBe(0);
    });

    it('应正确处理响应消息', () => {
      analyzer.processMessage(makeResponse('test-server', 1, 'tools/list', { tools: [] }));

      const stats = analyzer.getStats();
      expect(stats.totalResponses).toBe(1);
    });

    it('应正确统计错误响应', () => {
      // 监听 error 事件避免未处理错误
      analyzer.on('error', () => {});

      analyzer.processMessage(
        makeResponse('test-server', 1, 'tools/call', undefined, {
          code: -32601,
          message: 'Method not found'
        })
      );

      const stats = analyzer.getStats();
      expect(stats.totalErrors).toBe(1);
    });
  });

  describe('请求-响应关联', () => {
    it('应关联请求和响应并生成调用记录', () => {
      const requestMsg = makeRequest('server-a', 42, 'tools/call', { name: 'test' });
      const responseMsg = makeResponse('server-a', 42, 'tools/call', { result: 'ok' }, undefined, 150);

      analyzer.processMessage(requestMsg);
      analyzer.processMessage(responseMsg);

      const calls = analyzer.getCalls();
      expect(calls.length).toBe(1);
      expect(calls[0].id).toBe(42);
      expect(calls[0].method).toBe('tools/call');
      expect(calls[0].duration).toBe(150);
      expect(calls[0].status).toBe('success');
    });

    it('应将不同 Server 的相同 ID 视为不同请求', () => {
      analyzer.processMessage(makeRequest('server-a', 1, 'tools/list'));
      analyzer.processMessage(makeRequest('server-b', 1, 'tools/list'));
      analyzer.processMessage(makeResponse('server-a', 1, 'tools/list'));
      analyzer.processMessage(makeResponse('server-b', 1, 'tools/list'));

      const calls = analyzer.getCalls();
      expect(calls.length).toBe(2);
    });
  });

  describe('错误诊断', () => {
    it('应诊断认证错误', async () => {
      const errorEntry: IpcMessage = {
        type: 'response',
        serverName: 'test',
        timestamp: new Date().toISOString(),
        data: {
          method: 'tools/call',
          id: 1,
          error: { code: -1, message: 'Unauthorized: invalid token' }
        }
      };

      const diagnosisPromise = new Promise<string>((resolve) => {
        analyzer.on('error', (_entry, diagnosis) => {
          resolve(diagnosis);
        });
      });

      analyzer.processMessage(errorEntry);
      const diagnosis = await diagnosisPromise;
      expect(diagnosis).toContain('认证失败');
    });

    it('应诊断方法不存在错误（-32601）', async () => {
      const errorEntry: IpcMessage = {
        type: 'response',
        serverName: 'test',
        timestamp: new Date().toISOString(),
        data: {
          method: 'tools/unknown',
          id: 1,
          error: { code: -32601, message: 'Method not found' }
        }
      };

      const diagnosisPromise = new Promise<string>((resolve) => {
        analyzer.on('error', (_entry, diagnosis) => {
          resolve(diagnosis);
        });
      });

      analyzer.processMessage(errorEntry);
      const diagnosis = await diagnosisPromise;
      expect(diagnosis).toContain('方法不存在');
    });
  });

  describe('缓冲区管理', () => {
    it('应限制缓冲区大小', () => {
      // 发送 6000 条消息，超过 MAX_BUFFER_SIZE
      for (let i = 0; i < 6000; i++) {
        analyzer.processMessage({
          type: 'notification',
          serverName: 'test',
          timestamp: new Date().toISOString(),
          data: { method: 'notify', params: { n: i } }
        });
      }

      const logs = analyzer.getLogs();
      expect(logs.length).toBeLessThanOrEqual(5000);
    });

    it('应支持清空', () => {
      analyzer.processMessage(makeRequest('test', 1, 'tools/list'));
      analyzer.clear();

      expect(analyzer.getLogs().length).toBe(0);
      expect(analyzer.getStats().totalMessages).toBe(0);
    });
  });

  describe('日志过滤', () => {
    beforeEach(() => {
      analyzer.processMessage(makeRequest('server-a', 1, 'tools/list'));
      analyzer.processMessage(makeRequest('server-a', 2, 'tools/call'));
      analyzer.processMessage(makeRequest('server-b', 3, 'tools/list'));
    });

    it('应按 Server 名称过滤', () => {
      const filtered = analyzer.filterLogs({ serverName: 'server-a' });
      expect(filtered.length).toBe(2);
    });

    it('应按方法过滤', () => {
      const filtered = analyzer.filterLogs({ method: 'tools/list' });
      expect(filtered.length).toBe(2);
    });
  });
});
