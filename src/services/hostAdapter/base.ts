/**
 * Host Adapter 基类
 *
 * 提供所有 Host 适配器的通用实现
 */
import * as path from 'path';
import { HostConfig, McpConfigFile, ServerInstance } from '../../models';
import { backupFile, fileExists, readJsonFile, writeJsonFile } from '../../utils';
import { HostAdapter } from './types';

/**
 * Host Adapter 抽象基类
 *
 * 子类只需实现 abstract 属性和方法，通用逻辑由基类提供
 */
export abstract class BaseHostAdapter implements HostAdapter {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly configPath: string;

  /** @inheritdoc */
  async isInstalled(): Promise<boolean> {
    return fileExists(this.configPath);
  }

  /** @inheritdoc */
  async readConfig(): Promise<McpConfigFile> {
    if (!(await this.isInstalled())) {
      throw new Error(
        `${this.displayName} is not installed (config not found: ${this.configPath})`
      );
    }
    return readJsonFile<McpConfigFile>(this.configPath);
  }

  /** @inheritdoc */
  async writeConfig(config: McpConfigFile): Promise<void> {
    // 写入前自动备份
    await backupFile(this.configPath);
    await writeJsonFile(this.configPath, config);
  }

  /** @inheritdoc */
  async getServers(): Promise<ServerInstance[]> {
    const config = await this.readConfig();
    return Object.entries(config.mcpServers).map(([name, server]) => ({
      name,
      enabled: !server.disabled,
      monitoringEnabled: server._debugger?.monitoringEnabled === true,
      status: 'unknown' as const,
      command: server.command,
      args: server.args || [],
      env: server.env || {},
      _debugger: server._debugger
    }));
  }

  /** @inheritdoc */
  async injectWrapper(serverName: string, wrapperPath: string, ipcEndpoint: string): Promise<void> {
    const config = await this.readConfig();
    const serverConfig = config.mcpServers[serverName];

    if (!serverConfig) {
      throw new Error(`Server '${serverName}' not found in ${this.displayName}`);
    }

    // 已经注入则跳过
    if (serverConfig._debugger?.monitoringEnabled) {
      return;
    }

    // 保存原始命令
    const originalCommand = serverConfig.command;
    const originalArgs = serverConfig.args || [];

    // 注入 wrapper: node wrapper.js <serverName> <ipcEndpoint> <originalCommand> [args...]
    serverConfig.command = 'node';
    serverConfig.args = [wrapperPath, serverName, ipcEndpoint, originalCommand, ...originalArgs];

    // 添加调试器元数据
    serverConfig._debugger = {
      originalCommand,
      originalArgs,
      monitoringEnabled: true,
      ipcEndpoint,
      wrapperPath
    };

    await this.writeConfig(config);
  }

  /** @inheritdoc */
  async removeWrapper(serverName: string): Promise<void> {
    const config = await this.readConfig();
    const serverConfig = config.mcpServers[serverName];

    if (!serverConfig?._debugger) {
      return;
    }

    // 恢复原始命令
    serverConfig.command = serverConfig._debugger.originalCommand;
    serverConfig.args = serverConfig._debugger.originalArgs;
    delete serverConfig._debugger;

    await this.writeConfig(config);
  }

  /** @inheritdoc */
  async getHostConfig(): Promise<HostConfig> {
    const installed = await this.isInstalled();
    const servers = installed ? await this.getServers() : [];

    return {
      name: this.name,
      displayName: this.displayName,
      installed,
      configPath: this.configPath,
      servers
    };
  }
}

/**
 * 获取 wrapper 脚本的路径
 *
 * @param extensionPath - 扩展安装路径
 */
export function getWrapperPath(extensionPath: string): string {
  return path.join(extensionPath, 'dist', 'wrapper.js');
}
