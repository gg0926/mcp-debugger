/**
 * 命令注册模块
 *
 * 集中注册所有 VS Code 命令
 */
import * as vscode from 'vscode';
import { DashboardWebView } from '../providers/dashboardWebView';
import { ServerTreeProvider } from '../providers/serverTreeProvider';
import { HostManager, MonitoringService, StorageService } from '../services';

/** 命令 ID 前缀 */
export const COMMAND_PREFIX = 'mcpDebugger';

/** 命令 ID */
export const CommandIds = {
  openDashboard: `${COMMAND_PREFIX}.openDashboard`,
  refreshServers: `${COMMAND_PREFIX}.refreshServers`,
  selectHost: `${COMMAND_PREFIX}.selectHost`,
  toggleMonitoring: `${COMMAND_PREFIX}.toggleMonitoring`,
  clearLogs: `${COMMAND_PREFIX}.clearLogs`,
  callTestTool: `${COMMAND_PREFIX}.callTestTool`
} as const;

/**
 * 注册所有命令
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  hostManager: HostManager,
  storageService: StorageService,
  treeProvider: ServerTreeProvider,
  dashboard: DashboardWebView,
  monitoringService: MonitoringService
): void {
  // 打开 Dashboard
  const openDashboard = vscode.commands.registerCommand(CommandIds.openDashboard, async () => {
    await dashboard.show();
  });

  // 刷新 Server 列表
  const refreshServers = vscode.commands.registerCommand(CommandIds.refreshServers, () => {
    treeProvider.refresh();
    dashboard.refresh();
    vscode.window.showInformationMessage('MCP Debugger: Server list refreshed');
  });

  // 选择 Host
  const selectHost = vscode.commands.registerCommand(CommandIds.selectHost, async () => {
    const adapters = hostManager.getAllAdapters();
    const items = adapters.map((adapter) => ({
      label: adapter.displayName,
      description: adapter.name,
      picked: false
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a MCP Host'
    });

    if (selected) {
      await storageService.updateState({ selectedHost: selected.description! });
      treeProvider.refresh();
      vscode.window.showInformationMessage(`MCP Debugger: Selected host - ${selected.label}`);
    }
  });

  // 启用/禁用监控
  const toggleMonitoring = vscode.commands.registerCommand(
    CommandIds.toggleMonitoring,
    async (hostName: string, serverName: string) => {
      const isEnabled = monitoringService.isMonitoringEnabled(hostName, serverName);
      if (isEnabled) {
        await monitoringService.disableMonitoring(hostName, serverName);
      } else {
        await monitoringService.enableMonitoring(hostName, serverName);
      }
      treeProvider.refresh();
      dashboard.refresh();
    }
  );

  // 清空日志
  const clearLogs = vscode.commands.registerCommand(CommandIds.clearLogs, () => {
    monitoringService.clearLogs();
    dashboard.refresh();
    vscode.window.showInformationMessage('MCP Debugger: Logs cleared');
  });

  // 测试 MCP 工具调用（通过 Wrapper 启动 test-server）
  const callTestTool = vscode.commands.registerCommand(
    CommandIds.callTestTool,
    async () => {
      const { spawn } = await import('child_process');
      const path = await import('path');
      const net = await import('net');

      const testServerPath = path.join(context.extensionPath, 'test-server.js');
      const wrapperPath = path.join(context.extensionPath, 'dist', 'wrapper.js');
      const ipcEndpoint = monitoringService.getIpcEndpoint();

      // 启动 Wrapper + test-server
      const wrapper = spawn('node', [
        wrapperPath,
        'test-mcp-server',
        ipcEndpoint,
        'node',
        testServerPath
      ]);

      // 等待 Wrapper 连接
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 发送测试请求
      const sendRequest = (id: number, method: string, params: any) => {
        const msg = { jsonrpc: '2.0', id, method, params };
        const json = JSON.stringify(msg);
        const header = `Content-Length: ${Buffer.byteLength(json, 'utf-8')}\r\n\r\n`;
        wrapper.stdin.write(header + json);
      };

      let responseBuffer = Buffer.alloc(0);
      wrapper.stdout.on('data', (data: Buffer) => {
        responseBuffer = Buffer.concat([responseBuffer, data]);
        const headerEnd = responseBuffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;
        const header = responseBuffer.subarray(0, headerEnd).toString('utf-8');
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) return;
        const length = parseInt(match[1], 10);
        const bodyEnd = headerEnd + 4 + length;
        if (responseBuffer.length < bodyEnd) return;
        const body = responseBuffer.subarray(headerEnd + 4, bodyEnd).toString('utf-8');
        responseBuffer = responseBuffer.subarray(bodyEnd);
        try {
          const result = JSON.parse(body);
          vscode.window.showInformationMessage(
            `MCP 调用成功: ${result.result?.content || JSON.stringify(result.result)}`
          );
        } catch (e) {
          vscode.window.showErrorMessage(`解析失败: ${(e as Error).message}`);
        }
      });

      // 依次发送测试请求
      sendRequest(1, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'vscode-test', version: '1.0.0' }
      });
      await new Promise((r) => setTimeout(r, 200));
      sendRequest(2, 'tools/call', {
        name: 'echo',
        arguments: { message: 'Hello from VS Code MCP Debugger!' }
      });

      // 3秒后清理
      setTimeout(() => {
        wrapper.kill();
      }, 3000);
    }
  );

  context.subscriptions.push(
    openDashboard,
    refreshServers,
    selectHost,
    toggleMonitoring,
    clearLogs,
    callTestTool
  );
}
