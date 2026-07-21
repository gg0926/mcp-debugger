# Changelog

所有项目的显著变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.0.1] - 2026-07-20

### 新增

- **实时监控 Dashboard**：可视化展示 MCP Host 与 Server 之间的所有 JSON-RPC 通信
- **消息拦截**：通过 Wrapper 技术透明拦截 stdin/stdout 通信
- **统计面板**：实时显示总消息数、请求数、响应数、错误数、通知数
- **错误诊断**：自动识别 8 种常见错误模式并给出诊断建议
- **日志持久化**：所有日志自动保存到 `~/.mcp-debugger/logs/`
- **日志导出**：支持将当前日志导出为 JSON Lines 格式
- **消息详情面板**：点击任意日志条目查看完整的 JSON-RPC 消息内容
- **多 Host 支持**：
  - VS Code（`.vscode/mcp.json`）
  - Claude Desktop（`claude_desktop_config.json`）
  - Cursor（`~/.cursor/mcp.json`）
  - Windsurf（`~/.windsurf/mcp.json`）
  - Cline（`~/.cline/mcp_settings.json`）
- **单元测试**：32 个测试用例全部通过
- **端到端测试**：完整的 Wrapper + IPC + LogAnalyzer 链路验证

### 技术实现

- TypeScript 5.5 严格模式
- VS Code Extension API
- React WebView Dashboard
- Named Pipe / Unix Domain Socket IPC
- Webpack 5 构建
- Jest 单元测试

## [Unreleased]

### 计划

- [ ] 断点暂停：在指定方法前暂停 MCP 通信
- [ ] 消息修改重发：修改参数后重新发送请求
- [ ] 性能分析图表：耗时分布、QPS 统计
- [ ] 调用链路追踪：请求-响应配对可视化
- [ ] 配置同步：自动检测 Host 配置变更
