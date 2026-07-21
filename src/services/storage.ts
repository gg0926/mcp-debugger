/**
 * 存储服务
 *
 * 负责 VS Code 扩展的状态持久化，使用三种存储：
 * 1. globalState - 小数据、高频访问（VS Code 内置）
 * 2. SecretStorage - 敏感信息（API Token 等）
 * 3. 文件系统 - 日志、大配置
 */
import * as vscode from 'vscode';
import { ensureDir, getDebuggerDir, getLogDir } from '../utils';

/** 扩展全局状态 */
export interface DebuggerGlobalState {
  /** 监控中的 Server 列表 */
  monitoredServers: string[];
  /** 当前选中的 Host */
  selectedHost: string;
  /** 最后同步时间 */
  lastSync: string;
}

/** 默认全局状态 */
const DEFAULT_STATE: DebuggerGlobalState = {
  monitoredServers: [],
  selectedHost: 'claude-desktop',
  lastSync: ''
};

/**
 * 存储服务类
 */
export class StorageService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * 初始化存储目录
   */
  async initialize(): Promise<void> {
    await ensureDir(getDebuggerDir());
    await ensureDir(getLogDir());
  }

  /**
   * 读取全局状态
   */
  async getState(): Promise<DebuggerGlobalState> {
    const state = this.context.globalState.get<DebuggerGlobalState>('mcpDebugger.state');
    return { ...DEFAULT_STATE, ...state };
  }

  /**
   * 更新全局状态
   */
  async updateState(state: Partial<DebuggerGlobalState>): Promise<void> {
    const current = await this.getState();
    const next = { ...current, ...state };
    await this.context.globalState.update('mcpDebugger.state', next);
  }

  /**
   * 存储敏感信息
   *
   * @param serverName - Server 名称
   * @param key - 键名（如 'GITHUB_TOKEN'）
   * @param value - 敏感值
   */
  async storeSecret(serverName: string, key: string, value: string): Promise<void> {
    const storageKey = `mcpDebugger.secret.${serverName}.${key}`;
    await this.context.secrets.store(storageKey, value);
  }

  /**
   * 读取敏感信息
   *
   * @param serverName - Server 名称
   * @param key - 键名
   * @returns 敏感值，不存在返回 undefined
   */
  async getSecret(serverName: string, key: string): Promise<string | undefined> {
    const storageKey = `mcpDebugger.secret.${serverName}.${key}`;
    return this.context.secrets.get(storageKey);
  }

  /**
   * 删除敏感信息
   *
   * @param serverName - Server 名称
   * @param key - 键名
   */
  async deleteSecret(serverName: string, key: string): Promise<void> {
    const storageKey = `mcpDebugger.secret.${serverName}.${key}`;
    await this.context.secrets.delete(storageKey);
  }
}
