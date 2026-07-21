# MCP Debugger

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 专为 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 设计的实时监控与调试工具。

**GitHub:** [https://github.com/gg0926/mcp-debugger](https://github.com/gg0926/mcp-debugger)

## 功能特性

- **实时监控**：可视化展示 MCP Host 与 Server 之间的所有 JSON-RPC 通信
- **消息拦截**：通过 Wrapper 技术透明拦截 stdin/stdout 通信，零侵入
- **统计面板**：实时显示总消息数、请求数、响应数、错误数、通知数
- **错误诊断**：自动识别常见错误模式并给出诊断建议
- **日志持久化**：所有日志自动保存到 `~/.mcp-debugger/logs/`，支持导出分享
- **消息详情**：点击任意日志条目查看完整的 JSON-RPC 消息内容
- **多 Host 支持**：支持 VS Code、Claude Desktop、Cursor、Windsurf、Cline

## 安装

### 从 GitHub Release（推荐）

1. 下载最新的 `.vsix` 文件：[mcp-debugger-0.0.1.vsix](https://github.com/gg0926/mcp-debugger/releases/download/v0.0.1/mcp-debugger-0.0.1.vsix)
2. 在 VS Code 中按 `Ctrl+Shift+P`，输入 `Extensions: Install from VSIX`
3. 选择下载的 `.vsix` 文件

### 从 VS Code Marketplace

即将发布到 VS Code Marketplace，敬请期待！

## 快速开始

### 1. 打开 Dashboard

按 `Ctrl+Shift+P`，输入 `MCP Debugger: Open Dashboard`。

### 2. 配置 MCP Server

在 `.vscode/mcp.json`（或其他 Host 的配置文件）中添加 MCP Server 配置：

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["server.js"]
    }
  }
}
```

### 3. 启用监控

在 Dashboard 中找到你的 Server，点击"启用监控"按钮。

### 4. 重启 Host

重启你的 MCP Host（如 VS Code、Claude Desktop 等）以加载 Wrapper。

### 5. 查看实时日志

所有 MCP 通信将实时显示在 Dashboard 的"实时日志"区域。点击任意日志条目可查看完整详情。

## 架构设计

```
┌─────────────┐      ┌──────────┐      ┌─────────────┐
│  MCP Host   │◄────►│  Wrapper │◄────►│ MCP Server  │
└──────┬──────┘      └────┬─────┘      └─────────────┘
       │                  │
       │  IPC (Named Pipe)│
       ▼                  ▼
┌──────────────────────────────────────┐
│         MCP Debugger 扩展             │
│  ┌─────────┐  ┌─────────┐  ┌──────┐ │
│  │IPC Server│  │LogAnalyzer│  │Dashboard│ │
│  └─────────┘  └─────────┘  └──────┘ │
└──────────────────────────────────────┘
```

## 技术栈

- **TypeScript 5.5** - 核心语言
- **VS Code Extension API** - 扩展框架
- **React WebView** - Dashboard 界面
- **Named Pipe** - IPC 通信（Windows）/ Unix Domain Socket（Unix）
- **Jest** - 单元测试

## 开发

### 前置要求

- Node.js >= 18.x
- npm
- VS Code

### 安装依赖

```bash
npm install
```

### 构建

```bash
npm run build
```

### 运行测试

```bash
npm test
```

### 调试扩展

1. 在 VS Code 中打开项目
2. 按 `F5` 启动 Extension Development Host
3. 在 Extension Development Host 中打开测试项目
4. 运行 `MCP Debugger: Open Dashboard` 命令

### 打包

```bash
npm run package
```

## 项目结构

```
mcp-debugger/
├── src/
│   ├── commands/          # 命令注册
│   ├── models/            # 数据模型
│   ├── providers/         # WebView Provider
│   ├── services/          # 核心服务
│   │   ├── hostAdapter/   # Host 适配器
│   │   ├── hostManager.ts
│   │   ├── ipcServer.ts
│   │   ├── logAnalyzer.ts
│   │   └── monitoringService.ts
│   ├── utils/             # 工具函数
│   ├── wrapper/           # Wrapper 脚本
│   ├── extension.ts       # 扩展入口
│   └── webview/           # WebView UI
├── tests/                 # 测试
├── docs/                  # 文档
├── media/                 # 图标资源
└── package.json
```

## 支持的 Host

| Host | 配置文件路径 | 状态 |
|------|-------------|------|
| VS Code | `.vscode/mcp.json` | ✅ 支持 |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` | ✅ 支持 |
| Cursor | `~/.cursor/mcp.json` | ✅ 支持 |
| Windsurf | `~/.windsurf/mcp.json` | ✅ 支持 |
| Cline | `~/.cline/mcp_settings.json` | ✅ 支持 |

## 日志文件

日志默认保存到：

- **Windows**: `%USERPROFILE%\.mcp-debugger\logs\YYYY-MM-DD.jsonl`
- **macOS/Linux**: `~/.mcp-debugger/logs/YYYY-MM-DD.jsonl`

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

[MIT](LICENSE)
