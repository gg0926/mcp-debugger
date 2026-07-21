/**
 * 端到端测试脚本
 *
 * 测试完整链路：Test MCP Server ↔ Wrapper ↔ IPC ↔ LogAnalyzer
 *
 * 运行方式：
 *   node test-e2e.js
 *
 * 预期结果：
 *   - IPC 服务器启动
 *   - Wrapper 启动并连接 IPC
 *   - 测试 MCP Server 启动
 *   - 发送请求并收到响应
 *   - 日志通过 IPC 上报并被 LogAnalyzer 解析
 *   - 最终输出统计结果
 */

const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

// 测试配置
const TEST_SERVER = path.join(__dirname, 'test-server.js');
const WRAPPER = path.join(__dirname, 'dist', 'wrapper.js');

// 生成唯一的管道名
const PIPE_NAME = `\\\\.\\pipe\\mcp-debugger-test-${Date.now()}`;

// 消息计数
let requestCount = 0;
let responseCount = 0;
let notificationCount = 0;
let errorCount = 0;
let systemCount = 0;

// 收集到的日志
const logs = [];
const calls = [];
const pendingRequests = new Map();

console.log('='.repeat(60));
console.log('MCP Debugger - 端到端测试');
console.log('='.repeat(60));
console.log();

// 1. 启动 IPC 服务器
console.log('[1/5] 启动 IPC 服务器...');
const ipcServer = net.createServer((socket) => {
  console.log('  ✓ Wrapper 已连接 IPC');
  let buffer = '';

  socket.on('data', (data) => {
    buffer += data.toString('utf-8');

    let newlineIdx;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);

      if (!line) continue;

      try {
        const msg = JSON.parse(line);
        handleIpcMessage(msg);
      } catch (err) {
        console.log('  ✗ IPC 消息解析失败:', err.message);
      }
    }
  });

  socket.on('close', () => {
    console.log('  Wrapper 已断开连接');
  });
});

function handleIpcMessage(msg) {
  logs.push(msg);

  switch (msg.type) {
    case 'request':
      requestCount++;
      if (msg.data.id !== undefined && msg.data.method) {
        pendingRequests.set(msg.data.id, {
          method: msg.data.method,
          start: Date.now()
        });
      }
      break;
    case 'response':
      responseCount++;
      if (msg.data.error) {
        errorCount++;
      }
      if (msg.data.id !== undefined && pendingRequests.has(msg.data.id)) {
        const req = pendingRequests.get(msg.data.id);
        calls.push({
          id: msg.data.id,
          method: req.method,
          duration: msg.data.duration || (Date.now() - req.start),
          status: msg.data.error ? 'error' : 'success'
        });
        pendingRequests.delete(msg.data.id);
      }
      break;
    case 'notification':
      notificationCount++;
      break;
    case 'system':
      systemCount++;
      break;
    case 'stderr':
      // 忽略 stderr（测试服务器会输出 stderr）
      break;
  }
}

ipcServer.listen(PIPE_NAME, () => {
  console.log(`  ✓ IPC 服务器已启动: ${PIPE_NAME}`);
  startWrapper();
});

// 2. 启动 Wrapper
let wrapperProcess = null;

function startWrapper() {
  console.log();
  console.log('[2/5] 启动 Wrapper + Test MCP Server...');

  wrapperProcess = spawn('node', [WRAPPER, 'test-server', PIPE_NAME, 'node', TEST_SERVER], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let stderrOutput = '';
  wrapperProcess.stderr.on('data', (data) => {
    const text = data.toString();
    stderrOutput += text;
    console.log(`  [Wrapper stderr] ${text.trim()}`);
  });

  wrapperProcess.on('error', (err) => {
    console.log(`  ✗ Wrapper 启动失败: ${err.message}`);
    process.exit(1);
  });

  wrapperProcess.on('exit', (code, signal) => {
    console.log(`  [Wrapper exited] code: ${code}, signal: ${signal}`);
  });

  // 等一会儿让服务器启动
  setTimeout(() => {
    console.log('  ✓ Wrapper + Test Server 已启动');
    runTests();
  }, 1000);
}

// 3. 发送测试请求
function sendJsonRpc(stream, id, method, params) {
  const msg = {
    jsonrpc: '2.0',
    id,
    method,
    params
  };
  const json = JSON.stringify(msg);
  const header = `Content-Length: ${Buffer.byteLength(json, 'utf-8')}\r\n\r\n`;
  const data = header + json;
  console.log(`    SEND: ${method} (${data.length} bytes)`);
  stream.write(data);
}

let responseBuffer = Buffer.alloc(0);
let nextResponseId = null;
let responseCallbacks = new Map();

function handleWrapperResponse(data) {
  responseBuffer = Buffer.concat([responseBuffer, data]);
  console.log(`    RECEIVE: ${data.length} bytes, buffer now: ${responseBuffer.length} bytes`);

  while (true) {
    const headerEnd = responseBuffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;

    const header = responseBuffer.subarray(0, headerEnd).toString('utf-8');
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) break;

    const contentLength = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + contentLength;

    if (responseBuffer.length < bodyEnd) break;

    const body = responseBuffer.subarray(bodyStart, bodyEnd).toString('utf-8');
    responseBuffer = responseBuffer.subarray(bodyEnd);

    console.log(`    PARSE: Content-Length=${contentLength}, body=${body.substring(0, 100)}...`);

    try {
      const msg = JSON.parse(body);
      if (msg.id !== undefined && responseCallbacks.has(msg.id)) {
        const callback = responseCallbacks.get(msg.id);
        responseCallbacks.delete(msg.id);
        callback(null, msg);
      }
    } catch (err) {
      console.log('  ✗ 响应解析失败:', err.message);
    }
  }
}

function request(method, params) {
  return new Promise((resolve, reject) => {
    const id = Date.now() + Math.random();
    responseCallbacks.set(id, (err, msg) => {
      if (err) reject(err);
      else resolve(msg);
    });
    sendJsonRpc(wrapperProcess.stdin, id, method, params);
  });
}

async function runTests() {
  console.log();
  console.log('[3/5] 发送测试请求...');

  wrapperProcess.stdout.on('data', handleWrapperResponse);

  // 测试 1: initialize
  console.log('  测试 1: initialize...');
  const initResp = await request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' }
  });
  console.log(`    ✓ 返回: ${initResp.result?.name || 'unknown'}`);

  // 测试 2: tools/list
  console.log('  测试 2: tools/list...');
  const toolsResp = await request('tools/list', {});
  console.log(`    ✓ 返回 ${toolsResp.result?.length || 0} 个工具`);

  // 测试 3: tools/call - echo
  console.log('  测试 3: tools/call (echo)...');
  const echoResp = await request('tools/call', {
    name: 'echo',
    arguments: { message: 'Hello MCP Debugger!' }
  });
  console.log(`    ✓ 返回: ${echoResp.result?.content}`);

  // 测试 4: tools/call - delay (测量耗时)
  console.log('  测试 4: tools/call (delay 500ms)...');
  const delayStart = Date.now();
  const delayResp = await request('tools/call', {
    name: 'delay',
    arguments: { ms: 500 }
  });
  const delayTime = Date.now() - delayStart;
  console.log(`    ✓ 延迟约 ${delayTime}ms`);

  // 测试 5: tools/call - error
  console.log('  测试 5: tools/call (error)...');
  const errorResp = await request('tools/call', {
    name: 'error',
    arguments: { code: -32601, message: 'Test error message' }
  });
  console.log(`    ✓ 错误: ${errorResp.error?.message}`);

  // 测试 6: tools/call - fibonacci
  console.log('  测试 6: tools/call (fibonacci 10)...');
  const fibResp = await request('tools/call', {
    name: 'fibonacci',
    arguments: { n: 10 }
  });
  console.log(`    ✓ 数列: [${fibResp.result?.sequence?.join(', ')}]`);

  console.log();
  console.log('[4/5] 等待日志通过 IPC 上报...');
  await new Promise((r) => setTimeout(r, 500));

  // 4. 输出结果
  printResults();

  // 5. 清理
  cleanup();
}

function printResults() {
  console.log();
  console.log('[5/5] 测试结果');
  console.log('-'.repeat(60));

  console.log();
  console.log('  IPC 日志统计:');
  console.log(`    总消息数:   ${logs.length}`);
  console.log(`    请求数:     ${requestCount}`);
  console.log(`    响应数:     ${responseCount}`);
  console.log(`    错误数:     ${errorCount}`);
  console.log(`    通知数:     ${notificationCount}`);
  console.log(`    系统消息:   ${systemCount}`);

  console.log();
  console.log('  调用记录:');
  for (const call of calls) {
    const statusIcon = call.status === 'success' ? '✓' : '✗';
    const duration = call.duration != null ? ` (${call.duration}ms)` : '';
    console.log(`    ${statusIcon} ${call.method}${duration}`);
  }

  console.log();
  console.log('-'.repeat(60));

  // 判断测试是否通过
  const passed =
    requestCount > 0 &&
    responseCount > 0 &&
    errorCount > 0 && // 我们故意发了一个 error 请求
    calls.some((c) => c.status === 'success') &&
    calls.some((c) => c.status === 'error');

  if (passed) {
    console.log('  ✓ 所有测试通过！监控链路工作正常。');
  } else {
    console.log('  ✗ 部分测试未通过，请检查日志。');
  }
  console.log();
}

function cleanup() {
  if (wrapperProcess) {
    wrapperProcess.kill();
  }
  ipcServer.close(() => {
    process.exit(0);
  });
}

// 错误处理
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
