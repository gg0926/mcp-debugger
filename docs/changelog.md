# 变更日志

本文件记录 MCP Debugger 项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- 初始化项目脚手架
  - TypeScript 5.5 + webpack 5 配置
  - React 18 WebView 构建配置
  - ESLint 8 + Prettier 3 代码规范
  - Jest 29 单元测试配置
- 实现 HostAdapter 架构
  - `HostAdapter` 接口定义
  - `BaseHostAdapter` 抽象基类
  - 5 个 Host 适配器：Claude Desktop、VS Code、Cursor、Windsurf、Cline
  - 配置注入（injectWrapper）和恢复（removeWrapper）逻辑
- 实现 `HostManager` 统一管理所有 Host
- 实现 `StorageService` 存储服务（globalState + SecretStorage）
- 实现 UI 层
  - `ServerTreeProvider`：侧边栏 Server 列表 TreeView
  - `DashboardWebView`：主仪表板 WebView（Phase 0 内联 HTML）
- 实现命令注册
  - `mcpDebugger.openDashboard`
  - `mcpDebugger.refreshServers`
  - `mcpDebugger.selectHost`
- 实现数据模型
  - `McpServer`、`HostConfig`、`ServerInstance`
  - `LogEntry`、`CallRecord`
- 实现工具函数
  - JSON-RPC 2.0 消息解析
  - 跨平台路径处理
  - 文件系统工具
- 编写技术文档
  - README
  - 架构设计文档
  - 开发指南

## 版本说明

- **Phase 0** (v0.0.1): 项目骨架 + HostAdapter + 基础 UI
- Phase 1 (计划中): MCP Wrapper + 实时监控
- Phase 2 (计划中): 错误诊断 + 性能分析
- Phase 3 (计划中): 配置管理 + 多 Host 扩展
- Phase 4 (计划中): 打磨 + 发布
