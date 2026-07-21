# MCP Debugger

> Real-time debugging and monitoring for MCP (Model Context Protocol) Servers.

MCP Debugger 是一个 VS Code 扩展，为 MCP Server 提供透明的调试体验——让 MCP 调用不再是黑盒。

## 功能特性

- **实时调用监控**：看到每一次 Tool 调用
- **请求/响应追踪**：完整的参数和返回值
- **错误诊断**：自动分析失败原因
- **性能分析**：识别慢调用
- **多 Host 支持**：Claude Desktop、Cursor、VS Code、Windsurf、Cline

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9
- VS Code >= 1.90.0

### 安装依赖

```bash
cd mcp-debugger
npm install
```

### 构建

```bash
npm run build
```

### 调试运行

1. 用 VS Code 打开项目
2. 按 `F5` 启动调试（或运行任务 `npm: build`）
3. 在弹出的 Extension Development Host 中测试扩展

### 打包发布

```bash
npm run package    # 生成 .vsix 文件
npm run publish    # 发布到 VS Code Marketplace
```

## 支持的 Host

| Host | 配置文件路径 | 状态 |
|------|-------------|------|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) | ✅ |
| Cursor | `~/.cursor/mcp.json` | ✅ |
| VS Code | `.vscode/mcp.json` | ✅ |
| Windsurf | `~/.windsurf/mcp.json` | ✅ |
| Cline | `~/.cline/mcp_settings.json` | ✅ |

## 工作原理

MCP Debugger 在 MCP Host 和 Server 之间注入一个轻量级的 Wrapper，拦截所有 JSON-RPC 通信并进行分析。

```
Host ──stdio──→ Wrapper (拦截层) ──stdio──→ Server
                    ↓
              解析 + 日志 + IPC
                    ↓
              VS Code 扩展 UI
```

详细架构请参考 [架构文档](./architecture.md)。

## 开发指南

请参考 [开发指南](./development.md)。

## 隐私说明

所有日志存储在本地，不会发送到任何外部服务器。

## 许可证

MIT
