/**
 * Host 配置数据模型
 *
 * 描述 MCP Host（如 Claude Desktop、Cursor、VS Code）的配置信息
 */

/** 调试器注入的元数据 */
export interface DebuggerMeta {
  /** 原始命令（未注入 wrapper 之前） */
  originalCommand: string;
  /** 原始参数 */
  originalArgs: string[];
  /** 是否启用监控 */
  monitoringEnabled: boolean;
  /** IPC 管道路径（Wrapper 通过此路径连接到扩展） */
  ipcEndpoint: string;
  /** Wrapper 脚本路径 */
  wrapperPath: string;
}

/** 单个 Server 的配置实例 */
export interface ServerInstance {
  /** Server 名称 */
  name: string;
  /** 是否启用 */
  enabled: boolean;
  /** 是否启用监控 */
  monitoringEnabled: boolean;

  /** 运行时状态 */
  status: 'running' | 'stopped' | 'error' | 'unknown';
  /** 最后启动时间 */
  lastStarted?: string;
  /** 最后错误信息 */
  lastError?: string;

  /** 启动命令 */
  command: string;
  /** 启动参数 */
  args: string[];
  /** 环境变量 */
  env: Record<string, string>;

  /** 调试器元数据（注入 wrapper 后生成） */
  _debugger?: DebuggerMeta;
}

/** Host 配置 */
export interface HostConfig {
  /** Host 标识名（如 'claude-desktop'） */
  name: string;
  /** 显示名称（如 'Claude Desktop'） */
  displayName: string;
  /** 是否已安装 */
  installed: boolean;
  /** 配置文件路径 */
  configPath: string;
  /** 该 Host 下的所有 Server 实例 */
  servers: ServerInstance[];
}

/** mcp.json 文件的根结构 */
export interface McpConfigFile {
  mcpServers: Record<
    string,
    {
      command: string;
      args?: string[];
      env?: Record<string, string>;
      disabled?: boolean;
      _debugger?: DebuggerMeta;
    }
  >;
}
