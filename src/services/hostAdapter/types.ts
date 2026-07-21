/**
 * Host Adapter 类型定义
 *
 * 定义所有 Host 适配器必须实现的接口
 */
import { HostConfig, McpConfigFile, ServerInstance } from '../../models';

/**
 * Host Adapter 接口
 *
 * 不同 Host（Claude Desktop、Cursor、VS Code 等）需要实现此接口
 * 以统一的方式读写配置、注入/移除 wrapper
 */
export interface HostAdapter {
  /** Host 标识名（如 'claude-desktop'） */
  readonly name: string;
  /** 显示名称（如 'Claude Desktop'） */
  readonly displayName: string;
  /** 配置文件路径 */
  readonly configPath: string;

  /** 检测 Host 是否安装 */
  isInstalled(): Promise<boolean>;

  /** 读取当前配置 */
  readConfig(): Promise<McpConfigFile>;

  /** 写入配置（含自动备份） */
  writeConfig(config: McpConfigFile): Promise<void>;

  /** 获取所有 Server 实例 */
  getServers(): Promise<ServerInstance[]>;

  /** 注入 Wrapper（修改启动命令以启用监控） */
  injectWrapper(serverName: string, wrapperPath: string, ipcEndpoint: string): Promise<void>;

  /** 移除 Wrapper（恢复原始启动命令） */
  removeWrapper(serverName: string): Promise<void>;

  /** 获取 Host 配置信息 */
  getHostConfig(): Promise<HostConfig>;
}
