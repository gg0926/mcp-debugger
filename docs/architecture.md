# MCP Debugger - 架构设计

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    VS Code 扩展主进程                     │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Extension   │  │  Commands    │  │  Providers   │    │
│  │ (入口)      │→  │  (命令注册)  │  │  (UI 提供者) │    │
│  └─────────────┘  └──────────────┘  └──────────────┘    │
│         │                                │               │
│         ↓                                │               │
│  ┌──────────────────────────────────────┐│               │
│  │         Services 层                   ││               │
│  │                                       ││               │
│  │  ┌──────────────┐  ┌──────────────┐  ││               │
│  │  │ HostManager  │  │ Monitoring   │  ││               │
│  │  │ (Host 管理)  │  │ Service      │──┘│               │
│  │  └──────────────┘  │ (监控中枢)   │   │               │
│  │                    └──────────────┘   │               │
│  │  ┌──────────────┐  ┌──────────────┐  │               │
│  │  │ HostAdapter  │  │ IpcServer    │  │               │
│  │  │ (配置注入)   │  │ (IPC 通信)   │  │               │
│  │  └──────────────┘  └──────────────┘  │               │
│  │                    ┌──────────────┐  │               │
│  │                    │ LogAnalyzer  │  │               │
│  │                    │ (日志分析)   │  │               │
│  │                    └──────────────┘  │               │
│  └──────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
                          ↑ IPC (Named Pipe / Unix Socket)
                          │
┌─────────────────────────┴───────────────────────────────┐
│                  Wrapper 进程（独立 Node.js）              │
│                                                          │
│   Host stdin/stdout ↔ Wrapper ↔ 真实 MCP Server          │
│                       │                                  │
│                       ├─ JSON-RPC 解析                   │
│                       ├─ 消息拦截                        │
│                       └─ IPC 上报                        │
└──────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. Wrapper（消息拦截器）

**文件**: [src/wrapper/wrapper.ts](file:///d:/d/idea/mcp-debugger/src/wrapper/wrapper.ts)

作为 Host 和真实 MCP Server 之间的中间层，拦截所有 stdio 通信。

**工作流程**:
1. Host 启动时，执行被注入的 wrapper 命令
2. Wrapper 连接 IPC 管道到扩展
3. Wrapper 启动真实 MCP Server 作为子进程
4. Host → Wrapper → Server: 转发 stdin，解析请求
5. Server → Wrapper → Host: 转发 stdout，解析响应
6. 每条 JSON-RPC 消息通过 IPC 上报到扩展

**启动参数**:
```
node wrapper.js <serverName> <ipcEndpoint> <originalCommand> [originalArgs...]
```

### 2. IPC 通信层

**文件**: [src/services/ipcServer.ts](file:///d:/d/idea/mcp-debugger/src/services/ipcServer.ts)

扩展端创建 IPC 服务器，Wrapper 作为客户端连接。

- **传输层**: Named Pipe (Windows) / Unix Domain Socket (Linux/Mac)
- **消息格式**: 每行一个 JSON 对象（以 `\n` 分隔）
- **消息类型**: `request` | `response` | `notification` | `stderr` | `system` | `error`

### 3. HostAdapter（配置注入）

**文件**: [src/services/hostAdapter/base.ts](file:///d:/d/idea/mcp-debugger/src/services/hostAdapter/base.ts)

每个 Host（Claude Desktop、Cursor 等）对应一个适配器，负责：
- 读取/写入 Host 的 mcp.json 配置文件
- 注入 Wrapper: 修改启动命令为 `node wrapper.js ...`
- 移除 Wrapper: 恢复原始启动命令
- 自动备份原始配置

**注入逻辑**:
```
原始: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem"] }
注入后: { command: "node", args: ["wrapper.js", "server-name", "\\\\.\\pipe\\xxx", "npx", "-y", "@modelcontextprotocol/server-filesystem"] }
```

### 4. LogAnalyzer（日志分析）

**文件**: [src/services/logAnalyzer.ts](file:///d:/d/idea/mcp-debugger/src/services/logAnalyzer.ts)

接收 IPC 消息并进行分析：
- 将原始消息转换为结构化 LogEntry
- 关联请求和响应（通过 JSON-RPC id），计算耗时
- 维护环形缓冲区（最大 5000 条）
- 检测常见错误模式并生成诊断说明

**错误诊断规则**:
| 错误码 | 诊断 |
|--------|------|
| -32601 | 方法不存在 |
| -32602 | 参数错误 |
| -32603 | 内部错误 |
| 消息含 "token"/"unauthorized" | 认证失败 |
| 消息含 "connect"/"econnrefused" | 连接失败 |
| 消息含 "timeout" | 请求超时 |
| 消息含 "not found"/"enoent" | 资源未找到 |
| 消息含 "permission"/"eacces" | 权限不足 |

### 5. MonitoringService（监控中枢）

**文件**: [src/services/monitoringService.ts](file:///d:/d/idea/mcp-debugger/src/services/monitoringService.ts)

连接 IPC 服务器、日志分析器和 HostAdapter：
- 启动/停止 IPC 服务器
- 启用/禁用特定 Server 的监控（注入/移除 Wrapper）
- 将 IPC 消息路由到 LogAnalyzer
- 通过事件通知 UI 更新

### 6. Dashboard WebView

**文件**: [src/providers/dashboardWebView.ts](file:///d:/d:/idea/mcp-debugger/src/providers/dashboardWebView.ts)

主仪表板，显示：
- 统计卡片（总消息/请求/响应/错误/通知数）
- Host 列表（含 Server 状态和监控开关）
- 实时日志流（支持过滤、清空）

## 数据流

```
1. 用户在 Dashboard 点击"启用监控"
   ↓
2. MonitoringService.enableMonitoring()
   ↓
3. HostAdapter.injectWrapper() 修改 mcp.json
   ↓
4. 用户重启 Host（如 Claude Desktop）
   ↓
5. Host 启动时执行 wrapper 命令
   ↓
6. Wrapper 连接 IPC，启动真实 Server
   ↓
7. 所有通信被拦截并通过 IPC 上报
   ↓
8. IpcServer 接收 → LogAnalyzer 处理
   ↓
9. 通过事件触发 Dashboard 实时更新
```

## 测试

```bash
npm run test:unit   # 运行单元测试
npm run compile     # TypeScript 类型检查
npm run lint        # ESLint 检查
npm run build       # 完整构建
```

## 依赖关系

- **vscode**: 扩展 API
- **uuid**: 生成唯一 ID
- **Node.js net**: IPC 通信
- **Node.js child_process**: Wrapper 启动子进程
