/**
 * Server Tree View Provider
 *
 * 提供侧边栏 Server 列表的树形数据
 */
import * as vscode from 'vscode';
import { ServerInstance } from '../models';
import { HostManager } from '../services';

/** Tree Item 类型 */
export type ServerTreeItem = HostTreeItem | ServerTreeItem_;

/** Host 节点 */
export class HostTreeItem extends vscode.TreeItem {
  constructor(
    public readonly hostName: string,
    public readonly displayName: string,
    public readonly installed: boolean,
    public readonly serverCount: number
  ) {
    super(displayName, vscode.TreeItemCollapsibleState.Expanded);
    this.description = `${serverCount} servers`;
    this.iconPath = new vscode.ThemeIcon(installed ? 'server' : 'server-off');
    this.contextValue = installed ? 'host-installed' : 'host-not-installed';
  }
}

/** Server 节点 */
export class ServerTreeItem_ extends vscode.TreeItem {
  constructor(
    public readonly hostName: string,
    public readonly server: ServerInstance
  ) {
    super(server.name, vscode.TreeItemCollapsibleState.None);

    // 状态图标
    const icon = server.monitoringEnabled
      ? server.status === 'error'
        ? 'error'
        : server.status === 'running'
          ? 'circle-filled'
          : 'circle-outline'
      : 'circle-outline';

    this.iconPath = new vscode.ThemeIcon(icon);
    this.description = server.command;
    this.contextValue = server.monitoringEnabled ? 'server-monitored' : 'server-unmonitored';

    this.tooltip = `${server.name}\n${server.command} ${server.args.join(' ')}\n监控: ${server.monitoringEnabled ? '启用' : '未启用'}`;
  }
}

/**
 * Server Tree Data Provider
 */
export class ServerTreeProvider implements vscode.TreeDataProvider<ServerTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ServerTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly hostManager: HostManager) {}

  /**
   * 刷新树
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * 获取 TreeItem
   */
  getTreeItem(element: ServerTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * 获取子节点
   */
  async getChildren(element?: ServerTreeItem): Promise<ServerTreeItem[]> {
    if (!element) {
      // 根节点：返回所有 Host
      const configs = await this.hostManager.getAllHostConfigs();
      return configs.map(
        (config) =>
          new HostTreeItem(config.name, config.displayName, config.installed, config.servers.length)
      );
    }

    if (element instanceof HostTreeItem) {
      // Host 节点：返回该 Host 下的所有 Server
      const adapter = this.hostManager.getAdapter(element.hostName);
      if (!adapter) {
        return [];
      }
      const config = await adapter.getHostConfig();
      return config.servers.map((server) => new ServerTreeItem_(element.hostName, server));
    }

    // Server 节点没有子节点
    return [];
  }
}
