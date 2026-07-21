/**
 * 测试用 MCP Server
 *
 * 实现最小的 MCP 协议，用于测试 MCP Debugger 的监控功能。
 *
 * 启动方式：
 *   node test-server.js
 *
 * 提供的工具：
 *   - echo: 返回输入内容
 *   - delay: 延迟指定毫秒后返回
 *   - error: 模拟错误响应
 *   - fibonacci: 计算斐波那契数列
 */

/** 工具定义 */
const TOOLS = [
  {
    name: 'echo',
    description: '返回输入内容',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '要返回的消息' }
      },
      required: ['message']
    }
  },
  {
    name: 'delay',
    description: '延迟指定毫秒后返回',
    inputSchema: {
      type: 'object',
      properties: {
        ms: { type: 'number', description: '延迟毫秒数' }
      },
      required: ['ms']
    }
  },
  {
    name: 'error',
    description: '模拟错误响应',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'number', description: '错误码' },
        message: { type: 'string', description: '错误消息' }
      },
      required: ['code', 'message']
    }
  },
  {
    name: 'fibonacci',
    description: '计算斐波那契数列',
    inputSchema: {
      type: 'object',
      properties: {
        n: { type: 'number', description: '数列长度' }
      },
      required: ['n']
    }
  }
];

/** 计算斐波那契 */
function fibonacci(n) {
  const result = [0, 1];
  for (let i = 2; i < n; i++) {
    result[i] = result[i - 1] + result[i - 2];
  }
  return result.slice(0, n);
}

/** 发送 JSON-RPC 响应 */
function sendResponse(id, result, error) {
  const response = {
    jsonrpc: '2.0',
    id
  };
  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }
  const json = JSON.stringify(response);
  const header = `Content-Length: ${Buffer.byteLength(json, 'utf-8')}\r\n\r\n`;
  process.stdout.write(header + json);
}

/** 处理工具调用 */
async function handleToolsCall(id, params) {
  const { name, arguments: args } = params;

  switch (name) {
    case 'echo':
      sendResponse(id, { content: args.message });
      break;

    case 'delay':
      await new Promise((resolve) => setTimeout(resolve, args.ms));
      sendResponse(id, { delayed: true, ms: args.ms });
      break;

    case 'error':
      sendResponse(id, undefined, { code: args.code, message: args.message });
      break;

    case 'fibonacci':
      sendResponse(id, { sequence: fibonacci(args.n) });
      break;

    default:
      sendResponse(id, undefined, {
        code: -32601,
        message: `Method not found: ${name}`
      });
  }
}

/** 处理消息 */
let buffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);

  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;

    const header = buffer.subarray(0, headerEnd).toString('utf-8');
    const contentLengthMatch = header.match(/Content-Length:\s*(\d+)/i);
    if (!contentLengthMatch) break;

    const contentLength = parseInt(contentLengthMatch[1], 10);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + contentLength;

    if (buffer.length < bodyEnd) break;

    const body = buffer.subarray(bodyStart, bodyEnd).toString('utf-8');
    buffer = buffer.subarray(bodyEnd);

    try {
      const msg = JSON.parse(body);

      switch (msg.method) {
        case 'initialize':
          sendResponse(msg.id, {
            name: 'test-mcp-server',
            version: '1.0.0',
            tools: TOOLS
          });
          break;

        case 'tools/call':
          handleToolsCall(msg.id, msg.params);
          break;

        case 'tools/list':
          sendResponse(msg.id, TOOLS);
          break;

        default:
          sendResponse(msg.id, undefined, {
            code: -32601,
            message: `Method not found: ${msg.method}`
          });
      }
    } catch (err) {
      sendResponse(msg?.id, undefined, {
        code: -32603,
        message: `Internal error: ${err.message}`
      });
    }
  }
});

console.error('[Test MCP Server] Started on stdio');
console.error('[Test MCP Server] Available tools: echo, delay, error, fibonacci');
