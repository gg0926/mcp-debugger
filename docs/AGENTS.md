# MCP Debugger - Agent 协作指南

## 项目概述

MCP Debugger 是一个 VS Code 扩展，用于调试和监控 MCP（Model Context Protocol）通信。它通过在 Host 和 MCP Server 之间插入 Wrapper 进程，拦截所有 JSON-RPC 消息，并通过 IPC 上报到 Dashboard 进行实时展示和分析。

## 核心功能目标

### 最终用户体验

1. **Dashboard 概览**：一个 WebView 面板，展示：
   - 统计卡片：总消息数、请求数、响应数、错误数、通知数
   - Host 列表：每个 Host 的安装状态、配置的 Server 数量
   - 实时日志流：过滤、搜索、清空功能
   - 监控开关：一键启用/禁用特定 Server 的监控

2. **消息拦截与分析**：
   - 自动关联请求和响应，计算耗时
   - 检测常见错误模式并提供诊断建议
   - 支持日志导出

3. **跨 Host 支持**：
   - VS Code
   - Claude Desktop
   - Cursor
   - Windsurf
   - Cline

## 当前状态

### 已完成的模块

| 模块 | 文件 | 状态 | 说明 |
|------|------|------|------|
| 扩展入口 | [src/extension.ts](file:///d:/d/idea/mcp-debugger/src/extension.ts) | ✅ | 注册命令、激活扩展 |
| 命令注册 | [src/commands/index.ts](file:///d:/d/idea/mcp-debugger/src/commands/index.ts) | ✅ | Open Dashboard, Enable/Disable Monitoring |
| Host Adapter 基类 | [src/services/hostAdapter/base.ts](file:///d:/d/idea/mcp-debugger/src/services/hostAdapter/base.ts) | ✅ | 配置读写、Wrapper 注入/移除 |
| VS Code Adapter | [src/services/hostAdapter/vscode.ts](file:///d:/d/idea/mcp-debugger/src/services/hostAdapter/vscode.ts) | ✅ | 工作区配置路径 |
| HostManager | [src/services/hostManager.ts](file:///d:/d/idea/mcp-debugger/src/services/hostManager.ts) | ✅ | 管理所有 Adapter |
| IPC Server | [src/services/ipcServer.ts](file:///d:/d/idea/mcp-debugger/src/services/ipcServer.ts) | ✅ | Named Pipe 通信 |
| LogAnalyzer | [src/services/logAnalyzer.ts](file:///d:/d/idea/mcp-debugger/src/services/logAnalyzer.ts) | ✅ | 日志分析、错误诊断 |
| MonitoringService | [src/services/monitoringService.ts](file:///d:/d/idea/mcp-debugger/src/services/monitoringService.ts) | ✅ | 监控中枢 |
| Dashboard WebView | [src/providers/dashboardWebView.ts](file:///d:/d/idea/mcp-debugger/src/providers/dashboardWebView.ts) | ✅ | 主仪表板 |
| Server TreeView | [src/providers/serverTreeProvider.ts](file:///d:/d/idea/mcp-debugger/src/providers/serverTreeProvider.ts) | ✅ | 左侧服务器列表 |
| Wrapper | [src/wrapper/wrapper.ts](file:///d:/d/idea/mcp-debugger/src/wrapper/wrapper.ts) | ✅ | 消息拦截器 |
| JSON-RPC 工具 | [src/utils/jsonrpc.ts](file:///d:/d/idea/mcp-debugger/src/utils/jsonrpc.ts) | ✅ | 消息解析、序列化 |
| 端到端测试 | [test-e2e.js](file:///d:/d/idea/mcp-debugger/test-e2e.js) | ✅ | 验证完整链路 |
| 测试服务器 | [test-server.js](file:///d:/d/idea/mcp-debugger/test-server.js) | ✅ | 提供 echo/delay/error/fibonacci 工具 |

### 待完成的模块

| 模块 | 状态 | 说明 |
|------|------|------|
| VS Code 配置读取修复 | 🔴 | 当前显示 0 servers，需修复配置路径 |
| 监控启用/禁用功能 | 🔴 | Dashboard 中的监控开关需要连接到实际逻辑 |
| WebView 样式优化 | 🟡 | Dashboard 界面需要美化 |
| 日志过滤功能 | 🟡 | 实时日志的过滤和搜索 |
| 单元测试 | 🟡 | 各模块的单元测试 |

## 关键问题

### 问题 1：VS Code 显示 0 servers

**现象**：Dashboard 中 VS Code 显示"未安装"，左侧 TreeView 显示 0 servers。

**原因**：可能是配置路径问题或配置文件内容格式问题。

**验证方法**：
1. 检查 `.vscode/mcp.json` 文件是否存在
2. 检查 VSCodeAdapter 的 configPath 是否正确
3. 检查 `readConfig` 方法是否能正确解析配置

**待办**：
- [ ] 修复 VSCodeAdapter 的配置读取逻辑
- [ ] 确保 `.vscode/mcp.json` 被正确识别

### 问题 2：监控开关未连接

**现象**：Dashboard 中有"启用监控"按钮，但点击后没有实际效果。

**原因**：命令已注册，但尚未连接到 MonitoringService 的 enableMonitoring 方法。

**待办**：
- [ ] 实现 enableMonitoring 命令逻辑
- [ ] 实现 disableMonitoring 命令逻辑
- [ ] 更新 Dashboard 中的按钮状态

### 问题 3：Windsurf 重复显示

**现象**：Dashboard 中 Windsurf 出现了两次。

**原因**：可能是 HostManager 中重复注册或渲染逻辑问题。

**待办**：
- [ ] 检查 HostManager 中是否重复注册
- [ ] 检查 Dashboard 渲染逻辑

## 开发步骤建议

### Phase 2：修复配置读取

1. 修复 VSCodeAdapter 的配置路径问题
2. 确保 `.vscode/mcp.json` 被正确读取
3. 验证 Dashboard 中显示正确的 Server 数量

### Phase 3：实现监控开关

1. 实现 enableMonitoring 命令
2. 实现 disableMonitoring 命令
3. 更新 Dashboard 按钮状态
4. 测试完整监控流程

### Phase 4：完善 Dashboard

1. 添加日志过滤功能
2. 优化样式
3. 添加错误诊断显示

### Phase 5：测试和发布

1. 编写单元测试
2. 集成测试
3. 打包发布

## 常用命令

```bash
# 构建
npm run build

# 启动调试
# 在 VS Code 中按 F5

# 端到端测试
node test-e2e.js

# 类型检查
npm run compile

# 代码检查
npm run lint
```

## 关键文件说明

| 文件 | 作用 |
|------|------|
| `package.json` | 扩展配置、依赖、命令注册 |
| `src/extension.ts` | 扩展入口，激活时初始化所有服务 |
| `src/services/monitoringService.ts` | 监控中枢，协调所有监控相关操作 |
| `src/wrapper/wrapper.ts` | Wrapper 进程，拦截 MCP 通信 |
| `src/providers/dashboardWebView.ts` | Dashboard WebView，用户界面 |
| `dist/extension.js` | 扩展构建产物 |
| `dist/wrapper.js` | Wrapper 构建产物 |
| `dist/webview.js` | WebView 构建产物 |

## 调试技巧

1. **查看扩展日志**：在 Extension Development Host 中，按 `Ctrl+Shift+I` 打开 Developer Tools，查看 Console 标签页。
2. **查看 Output 面板**：在 Extension Development Host 中，打开 Output 面板，选择 "Log (Extension Host)"。
3. **端到端测试**：运行 `node test-e2e.js` 验证完整链路是否正常。

## 注意事项

1. **Windows 路径**：使用 `path.join()` 处理路径，Windows 使用反斜杠，Linux/Mac 使用正斜杠。
2. **IPC 通信**：Windows 使用 Named Pipe（`\\.\pipe\...`），Linux/Mac 使用 Unix Domain Socket。
3. **VS Code API**：`vscode` 模块在 Node.js 环境中不可用，只能在 VS Code 扩展运行时使用。
4. **构建产物**：修改源代码后必须重新构建才能在调试窗口中生效。
