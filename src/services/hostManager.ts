/**
 * Host Manager 服务
 *
 * 统一管理所有 Host Adapter，提供统一的访问入口
 */
import * as vscode from 'vscode';
import { HostConfig } from '../models';
import {
  ClaudeDesktopAdapter,
  CursorAdapter,
  HostAdapter,
  VSCodeAdapter,
  WindsurfAdapter,
  ClineAdapter
} from './hostAdapter';

/**
 * Host Manager
 *
 * 负责创建和管理所有 Host Adapter 实例
 */
export class HostManager {
  private adapters: Map<string, HostAdapter> = new Map();

  constructor(_context: vscode.ExtensionContext) {
    // 注册所有 Host Adapter
    this.registerAdapter(new ClaudeDesktopAdapter());
    this.registerAdapter(new CursorAdapter());
    this.registerAdapter(new WindsurfAdapter());
    this.registerAdapter(new ClineAdapter());

    // VS Code Adapter 需要工作区路径
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    console.log(`[MCP Debugger] workspacePath: ${workspacePath}`);
    this.registerAdapter(new VSCodeAdapter(workspacePath));
  }

  /**
   * 注册 Host Adapter
   */
  private registerAdapter(adapter: HostAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  /**
   * 获取所有 Host Adapter
   */
  getAllAdapters(): HostAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * 获取所有已安装的 Host Adapter
   */
  async getInstalledAdapters(): Promise<HostAdapter[]> {
    const installed: HostAdapter[] = [];
    for (const adapter of this.adapters.values()) {
      if (await adapter.isInstalled()) {
        installed.push(adapter);
      }
    }
    return installed;
  }

  /**
   * 根据 Host 名称获取 Adapter
   */
  getAdapter(name: string): HostAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * 获取所有 Host 的配置信息
   */
  async getAllHostConfigs(): Promise<HostConfig[]> {
    const configs: HostConfig[] = [];
    for (const adapter of this.adapters.values()) {
      const config = await adapter.getHostConfig();
      configs.push(config);
    }
    return configs;
  }
}
