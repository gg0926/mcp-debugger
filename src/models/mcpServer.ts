/**
 * MCP Server 数据模型
 *
 * 描述一个 MCP Server 的元数据信息
 */

/** Server 安装方式 */
export type InstallType = 'npm' | 'pip' | 'docker' | 'git' | 'local';

/** Server 来源 */
export type ServerSource = 'official' | 'pulsemcp' | 'smithery' | 'github' | 'local';

/** Server 配置 Schema 中的单个字段定义 */
export interface ConfigSchemaProperty {
  type: string;
  title: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: string[];
}

/** Server 的配置 Schema */
export interface ConfigSchema {
  type: 'object';
  properties: Record<string, ConfigSchemaProperty>;
  required?: string[];
}

/** Server 能力信息 */
export interface ServerCapabilities {
  tools?: string[];
  resources?: string[];
  prompts?: string[];
}

/** MCP Server 元数据 */
export interface McpServer {
  /** Server 名称（唯一标识） */
  name: string;
  /** 人类可读的描述 */
  description?: string;
  /** 包名（npm 包名或 pip 包名） */
  package: string;
  /** 版本号 */
  version?: string;

  /** 安装方式 */
  installType: InstallType;
  /** 安装命令（可选，用于自定义安装） */
  installCommand?: string;

  /** 配置 Schema */
  configSchema?: ConfigSchema;

  /** 能力信息 */
  capabilities?: ServerCapabilities;

  /** 元数据 */
  source: ServerSource;
  stars?: number;
  downloads?: number;
  lastUpdated?: string;
}
