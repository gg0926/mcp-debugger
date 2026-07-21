/**
 * MCP Debugger - VS Code 扩展入口
 *
 * 扩展激活时初始化所有服务（HostManager、MonitoringService）和 UI 组件
 */
import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { DashboardWebView } from './providers/dashboardWebView';
import { ServerTreeProvider } from './providers/serverTreeProvider';
import { HostManager, MonitoringService, StorageService } from './services';

/**
 * 扩展激活入口
 *
 * @param context - 扩展上下文
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('[MCP Debugger] Extension activating...');

  // 1. 初始化存储服务
  const storageService = new StorageService(context);
  try {
    await storageService.initialize();
  } catch (err) {
    console.error('[MCP Debugger] Storage init failed:', err);
  }

  // 2. 初始化 Host 管理器
  const hostManager = new HostManager(context);

  // 3. 初始化监控服务（启动 IPC 服务器）
  const monitoringService = new MonitoringService(context, hostManager);
  try {
    await monitoringService.initialize();
    context.subscriptions.push({ dispose: () => monitoringService.dispose() });
  } catch (err) {
    console.error('[MCP Debugger] Monitoring service init failed:', err);
  }

  // 4. 初始化 UI 组件
  const treeProvider = new ServerTreeProvider(hostManager);
  const dashboard = new DashboardWebView(hostManager, monitoringService);

  // 5. 注册 TreeView
  const treeView = vscode.window.createTreeView('mcpDebugger.servers', {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);

  // 6. 注册命令（无论前面步骤是否成功，命令必须注册）
  registerCommands(
    context,
    hostManager,
    storageService,
    treeProvider,
    dashboard,
    monitoringService
  );

  // 7. 初始化默认状态
  try {
    const state = await storageService.getState();
    if (!state.lastSync) {
      await storageService.updateState({
        lastSync: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('[MCP Debugger] State init failed:', err);
  }

  // 8. 监控服务事件 - 错误诊断通知
  monitoringService.on('diagnosis', (entry, diagnosis) => {
    vscode.window.showWarningMessage(`MCP Debugger [${entry.serverName}]: ${diagnosis}`);
  });

  monitoringService.on('wrapperConnected', (serverName) => {
    vscode.window.showInformationMessage(`MCP Debugger: ${serverName} 已连接`);
    treeProvider.refresh();
    dashboard.refresh();
  });

  monitoringService.on('wrapperDisconnected', () => {
    treeProvider.refresh();
    dashboard.refresh();
  });

  console.log('[MCP Debugger] Extension activated successfully');
  console.log(`[MCP Debugger] IPC endpoint: ${monitoringService.getIpcEndpoint()}`);
  vscode.window.showInformationMessage('MCP Debugger: 扩展已激活');
}

/**
 * 扩展停用入口
 */
export function deactivate(): void {
  console.log('[MCP Debugger] Extension deactivated');
}
