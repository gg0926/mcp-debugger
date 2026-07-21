/**
 * Dashboard WebView Provider
 *
 * 提供主仪表板的 WebView 面板，显示实时监控数据
 */
import * as vscode from 'vscode';
import { HostManager, MonitoringService } from '../services';
import { LogEntry } from '../models/logEntry';

/**
 * Dashboard WebView 管理器
 */
export class DashboardWebView {
  public static readonly viewType = 'mcpDebugger.dashboard';
  private panel: vscode.WebviewPanel | undefined;
  private hostManager: HostManager;
  private monitoringService: MonitoringService;
  private logUpdateTimer: NodeJS.Timeout | undefined;
  private pendingLogs: LogEntry[] = [];

  constructor(hostManager: HostManager, monitoringService: MonitoringService) {
    this.hostManager = hostManager;
    this.monitoringService = monitoringService;
  }

  /** 显示 Dashboard 面板 */
  async show(): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      DashboardWebView.viewType,
      'MCP Debugger',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.getExtensionUri(), 'dist')]
      }
    );

    this.panel.title = 'MCP Debugger Dashboard';
    this.panel.webview.html = this.getHtmlContent();

    // 处理来自 WebView 的消息
    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      undefined,
      undefined
    );

    // 面板关闭时清理
    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.stopLogStreaming();
    });

    // 开始流式推送日志
    this.startLogStreaming();
  }

  /** 处理 WebView 消息 */
  private async handleMessage(message: { command: string; data?: unknown }): Promise<void> {
    switch (message.command) {
      case 'refresh':
      case 'getHosts':
        await this.sendHostData();
        break;
      case 'getStats':
        this.sendStats();
        break;
      case 'getLogs':
        this.sendLogs();
        break;
      case 'clearLogs':
        this.monitoringService.clearLogs();
        await this.sendHostData();
        this.sendStats();
        break;
      case 'exportLogs':
        this.exportLogs();
        break;
      case 'getLogDetail': {
        const entryId = (message.data as { entryId?: string })?.entryId;
        if (entryId) {
          this.sendLogDetail(entryId);
        }
        break;
      }
      case 'enableMonitoring': {
        const { hostName, serverName } = message.data as { hostName: string; serverName: string };
        try {
          await this.monitoringService.enableMonitoring(hostName, serverName);
          await this.sendHostData();
        } catch (err) {
          vscode.window.showErrorMessage(`启用监控失败: ${(err as Error).message}`);
        }
        break;
      }
      case 'disableMonitoring': {
        const { hostName, serverName } = message.data as { hostName: string; serverName: string };
        try {
          await this.monitoringService.disableMonitoring(hostName, serverName);
          await this.sendHostData();
        } catch (err) {
          vscode.window.showErrorMessage(`禁用监控失败: ${(err as Error).message}`);
        }
        break;
      }
    }
  }

  /** 发送 Host 数据到 WebView */
  private async sendHostData(): Promise<void> {
    if (!this.panel) {
      return;
    }

    const configs = await this.hostManager.getAllHostConfigs();
    const connectedWrappers = this.monitoringService.getConnectedWrappers();

    const data = configs.map((config) => ({
      name: config.name,
      displayName: config.displayName,
      installed: config.installed,
      serverCount: config.servers.length,
      servers: config.servers.map((server) => ({
        name: server.name,
        monitoringEnabled: server.monitoringEnabled,
        connected: connectedWrappers.includes(server.name),
        status:
          server.monitoringEnabled && connectedWrappers.includes(server.name)
            ? 'running'
            : 'stopped',
        command: server.command
      }))
    }));

    this.panel.webview.postMessage({
      command: 'hostData',
      data
    });
  }

  /** 发送统计信息 */
  private sendStats(): void {
    if (!this.panel) return;
    const stats = this.monitoringService.getStats();
    this.panel.webview.postMessage({
      command: 'stats',
      data: stats
    });
  }

  /** 发送所有日志 */
  private sendLogs(): void {
    if (!this.panel) return;
    const logs = this.monitoringService.getLogs();
    this.panel.webview.postMessage({
      command: 'logs',
      data: logs
    });
  }

  /** 开始流式推送日志 */
  private startLogStreaming(): void {
    // 监听新日志
    this.monitoringService.on('log', (entry) => {
      this.pendingLogs.push(entry);
    });

    // 每 200ms 批量推送一次
    this.logUpdateTimer = setInterval(() => {
      if (this.pendingLogs.length === 0 || !this.panel) return;
      const logs = this.pendingLogs.splice(0, 100);
      this.panel.webview.postMessage({
        command: 'logBatch',
        data: logs
      });
      this.sendStats();
    }, 200);
  }

  /** 停止日志流 */
  private stopLogStreaming(): void {
    if (this.logUpdateTimer) {
      clearInterval(this.logUpdateTimer);
      this.logUpdateTimer = undefined;
    }
    this.pendingLogs = [];
  }

  /** 刷新 Dashboard */
  async refresh(): Promise<void> {
    if (this.panel) {
      await this.sendHostData();
      this.sendStats();
      this.sendLogs();
    }
  }

  /** 获取 HTML 内容 */
  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Debugger Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 0;
    }

    /* 顶部标题栏 */
    .header {
      background: linear-gradient(135deg, #0078d4 0%, #005a9e 100%);
      padding: 16px 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .header-icon {
      width: 32px;
      height: 32px;
      background: rgba(255,255,255,0.2);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    .header h1 {
      color: white;
      font-size: 18px;
      font-weight: 600;
      margin: 0;
    }
    .header-subtitle {
      color: rgba(255,255,255,0.8);
      font-size: 12px;
      margin-left: auto;
    }

    .content {
      padding: 20px 24px;
    }

    /* 统计卡片 */
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--vscode-foreground);
      margin: 0 0 12px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title::before {
      content: '';
      width: 3px;
      height: 14px;
      background: var(--vscode-textLink-foreground);
      border-radius: 2px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 16px 12px;
      text-align: center;
      transition: all 0.2s;
      position: relative;
      overflow: hidden;
    }
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
    }
    .stat-card.total::before { background: var(--vscode-charts-blue); }
    .stat-card.requests::before { background: var(--vscode-charts-purple); }
    .stat-card.responses::before { background: var(--vscode-charts-green); }
    .stat-card.errors::before { background: var(--vscode-charts-red); }
    .stat-card.notifications::before { background: var(--vscode-charts-orange); }
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      line-height: 1;
      margin-bottom: 4px;
    }
    .stat-card.total .stat-value { color: var(--vscode-charts-blue); }
    .stat-card.requests .stat-value { color: var(--vscode-charts-purple); }
    .stat-card.responses .stat-value { color: var(--vscode-charts-green); }
    .stat-card.errors .stat-value { color: var(--vscode-charts-red); }
    .stat-card.notifications .stat-value { color: var(--vscode-charts-orange); }
    .stat-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    /* Host 卡片 */
    .hosts-section { margin-bottom: 24px; }
    .host-card {
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 10px;
      transition: all 0.2s;
    }
    .host-card:hover {
      border-color: var(--vscode-textLink-foreground);
    }
    .host-card.installed {
      border-left: 3px solid var(--vscode-charts-green);
    }
    .host-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .host-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 14px;
    }
    .host-status {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
    }
    .host-status.installed {
      background: rgba(0, 200, 100, 0.15);
      color: var(--vscode-charts-green);
    }
    .host-status.not-installed {
      background: rgba(150, 150, 150, 0.15);
      color: var(--vscode-descriptionForeground);
    }
    .server-list { list-style: none; padding: 0; margin: 0; }
    .server-list li {
      padding: 10px 12px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--vscode-editor-background);
    }
    .server-list li:last-child { margin-bottom: 0; }
    .server-info { flex: 1; }
    .server-name {
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .server-cmd {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      font-family: var(--vscode-editor-font-family);
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 600;
    }
    .badge-enabled {
      background: rgba(0, 180, 100, 0.2);
      color: var(--vscode-charts-green);
    }
    .badge-disabled {
      background: rgba(150, 150, 150, 0.2);
      color: var(--vscode-descriptionForeground);
    }
    .badge-connected {
      background: rgba(0, 120, 212, 0.2);
      color: var(--vscode-charts-blue);
    }
    .btn {
      padding: 5px 12px;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.15s;
    }
    .btn:hover {
      background: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-secondaryBackground));
    }
    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
    }
    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    /* 日志区域 */
    .log-section { margin-bottom: 20px; }
    .toolbar {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      align-items: center;
    }
    .toolbar input {
      flex: 1;
      padding: 6px 12px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-size: 13px;
    }
    .toolbar input:focus {
      outline: none;
      border-color: var(--vscode-textLink-foreground);
    }
    .log-container {
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      max-height: 500px;
      overflow-y: auto;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
    }
    .log-entry {
      padding: 6px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
      align-items: center;
      transition: background 0.1s;
    }
    .log-entry:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .log-time {
      color: var(--vscode-descriptionForeground);
      width: 80px;
      flex-shrink: 0;
      font-size: 11px;
    }
    .log-type {
      width: 70px;
      flex-shrink: 0;
      font-weight: 600;
      font-size: 11px;
      text-align: center;
      padding: 1px 6px;
      border-radius: 3px;
    }
    .log-type-request { color: var(--vscode-charts-blue); background: rgba(0, 120, 212, 0.1); }
    .log-type-response { color: var(--vscode-charts-green); background: rgba(0, 200, 100, 0.1); }
    .log-type-notification { color: var(--vscode-charts-purple); background: rgba(150, 0, 200, 0.1); }
    .log-type-stderr { color: var(--vscode-charts-red); background: rgba(255, 82, 82, 0.1); }
    .log-type-system { color: var(--vscode-descriptionForeground); background: rgba(150, 150, 150, 0.1); }
    .log-method {
      color: var(--vscode-textLink-foreground);
      width: 140px;
      flex-shrink: 0;
      font-weight: 500;
    }
    .log-server {
      color: var(--vscode-descriptionForeground);
      width: 110px;
      flex-shrink: 0;
      font-size: 11px;
    }
    .log-duration {
      color: var(--vscode-charts-orange);
      width: 50px;
      flex-shrink: 0;
      font-size: 11px;
      text-align: right;
    }
    .log-detail {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--vscode-foreground);
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
    }

    /* 消息详情面板 */
    .detail-panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 480px;
      background: var(--vscode-editor-background);
      border-left: 1px solid var(--vscode-panel-border);
      box-shadow: -4px 0 16px rgba(0,0,0,0.3);
      z-index: 1000;
      transform: translateX(100%);
      transition: transform 0.2s ease;
      display: flex;
      flex-direction: column;
    }
    .detail-panel.active {
      transform: translateX(0);
    }
    .detail-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .detail-header h3 {
      font-size: 14px;
      font-weight: 600;
      margin: 0;
    }
    .detail-close {
      background: none;
      border: none;
      color: var(--vscode-foreground);
      font-size: 18px;
      cursor: pointer;
      padding: 4px 8px;
    }
    .detail-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
    }
    .detail-section {
      margin-bottom: 16px;
    }
    .detail-section-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .detail-json {
      background: var(--vscode-textCodeBlock-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 12px;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 300px;
      overflow-y: auto;
    }
    .detail-info {
      display: grid;
      grid-template-columns: 100px 1fr;
      gap: 6px 12px;
      font-size: 12px;
    }
    .detail-info-label {
      color: var(--vscode-descriptionForeground);
    }
    .detail-info-value {
      color: var(--vscode-foreground);
    }
    .detail-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.3);
      z-index: 999;
      display: none;
    }
    .detail-overlay.active {
      display: block;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-icon">🐞</div>
    <h1>MCP Debugger</h1>
    <span class="header-subtitle">实时监控 MCP 通信</span>
  </div>

  <div class="content">
    <div class="stats-grid">
      <div class="stat-card total">
        <div class="stat-value" id="stat-total">0</div>
        <div class="stat-label">总消息</div>
      </div>
      <div class="stat-card requests">
        <div class="stat-value" id="stat-requests">0</div>
        <div class="stat-label">请求数</div>
      </div>
      <div class="stat-card responses">
        <div class="stat-value" id="stat-responses">0</div>
        <div class="stat-label">响应数</div>
      </div>
      <div class="stat-card errors">
        <div class="stat-value" id="stat-errors">0</div>
        <div class="stat-label">错误数</div>
      </div>
      <div class="stat-card notifications">
        <div class="stat-value" id="stat-notifications">0</div>
        <div class="stat-label">通知数</div>
      </div>
    </div>

    <div class="hosts-section">
      <h2 class="section-title">Hosts</h2>
      <div id="hosts-container">
        <div class="empty-state">加载中...</div>
      </div>
    </div>

    <div class="log-section">
      <h2 class="section-title">实时日志</h2>
      <div class="toolbar">
        <input type="text" id="log-filter" placeholder="过滤日志（方法名、Server 名、错误信息）..." />
        <button class="btn" onclick="exportLogs()">导出日志</button>
        <button class="btn" onclick="clearLogs()">清空日志</button>
        <button class="btn" onclick="refreshLogs()">刷新</button>
      </div>
      <div class="log-container" id="log-container">
        <div class="empty-state">暂无日志。启用监控后，此处将实时显示 MCP 调用。</div>
      </div>
    </div>
  </div>

  <!-- 详情面板 -->
  <div class="detail-overlay" id="detail-overlay" onclick="closeDetail()"></div>
  <div class="detail-panel" id="detail-panel">
    <div class="detail-header">
      <h3>消息详情</h3>
      <button class="detail-close" onclick="closeDetail()">✕</button>
    </div>
    <div class="detail-body" id="detail-body">
      <div class="empty-state">点击日志条目查看详情</div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let allLogs = [];
    let filterText = '';
    let currentDetailEntry = null;

    vscode.postMessage({ command: 'getHosts' });
    vscode.postMessage({ command: 'getStats' });
    vscode.postMessage({ command: 'getLogs' });

    window.addEventListener('message', (event) => {
      const message = event.data;
      switch (message.command) {
        case 'hostData':
          renderHosts(message.data);
          break;
        case 'stats':
          renderStats(message.data);
          break;
        case 'logs':
          allLogs = message.data || [];
          renderLogs();
          break;
        case 'logBatch':
          allLogs = allLogs.concat(message.data || []);
          if (allLogs.length > 5000) allLogs = allLogs.slice(-5000);
          renderLogs();
          break;
        case 'logDetail':
          showDetail(message.data);
          break;
      }
    });

    function renderHosts(hosts) {
      const container = document.getElementById('hosts-container');
      if (!hosts || hosts.length === 0) {
        container.innerHTML = '<div class="empty-state">未发现任何 Host</div>';
        return;
      }
      container.innerHTML = hosts.map(host => {
        const statusClass = host.installed ? 'installed' : 'not-installed';
        const statusText = host.installed ? '已安装' : '未安装';
        const serversHtml = host.servers && host.servers.length > 0
          ? '<ul class="server-list">' + host.servers.map(s => {
              const badges = [];
              if (s.monitoringEnabled) badges.push('<span class="badge badge-enabled">监控中</span>');
              else badges.push('<span class="badge badge-disabled">未监控</span>');
              if (s.connected) badges.push('<span class="badge badge-connected">已连接</span>');
              const btn = s.monitoringEnabled
                ? '<button class="btn" onclick="toggleMonitoring(\\''+host.name+'\\', \\''+s.name+'\\', false)">禁用</button>'
                : '<button class="btn btn-primary" onclick="toggleMonitoring(\\''+host.name+'\\', \\''+s.name+'\\', true)">启用监控</button>';
              return '<li><div class="server-info"><div class="server-name">'+s.name+' ' + badges.join('') + '</div><div class="server-cmd">$ '+s.command+'</div></div>'+btn+'</li>';
            }).join('') + '</ul>'
          : '<div class="empty-state">暂无配置的 Server</div>';
        return '<div class="host-card ' + (host.installed ? 'installed' : '') + '"><div class="host-header"><div class="host-title">'+host.displayName+'</div><span class="host-status '+statusClass+'">'+statusText+' · '+host.serverCount+' Server</span></div>'+serversHtml+'</div>';
      }).join('');
    }

    function renderStats(stats) {
      document.getElementById('stat-total').textContent = stats.totalMessages || 0;
      document.getElementById('stat-requests').textContent = stats.totalRequests || 0;
      document.getElementById('stat-responses').textContent = stats.totalResponses || 0;
      document.getElementById('stat-errors').textContent = stats.totalErrors || 0;
      document.getElementById('stat-notifications').textContent = stats.totalNotifications || 0;
    }

    function renderLogs() {
      const container = document.getElementById('log-container');
      const filtered = filterText
        ? allLogs.filter(l => {
            const text = (filterText || '').toLowerCase();
            return (l.method && l.method.toLowerCase().includes(text)) ||
                   (l.serverName && l.serverName.toLowerCase().includes(text)) ||
                   (l.error && JSON.stringify(l.error).toLowerCase().includes(text)) ||
                   (l.type && l.type.toLowerCase().includes(text));
          })
        : allLogs;

      if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">' + (filterText ? '没有匹配的日志' : '暂无日志') + '</div>';
        return;
      }

      const display = filtered.slice(-500);
      container.innerHTML = display.map(l => {
        const time = new Date(l.timestamp).toLocaleTimeString('zh-CN', { hour12: false });
        const typeClass = 'log-type-' + l.type;
        const duration = l.duration ? '<span class="log-duration">'+l.duration+'ms</span>' : '';
        let detail = '';
        if (l.params) detail = JSON.stringify(l.params).substring(0, 200);
        else if (l.result !== undefined) detail = JSON.stringify(l.result).substring(0, 200);
        else if (l.error) detail = '⚠ ' + l.error.message;
        else if (l.type === 'stderr') detail = JSON.stringify(l.params || '').substring(0, 200);
        else if (l.type === 'system') detail = JSON.stringify(l.params || '').substring(0, 200);

        return '<div class="log-entry" onclick="showLogDetail(\\''+l.entryId+'\\')" style="cursor:pointer;"><span class="log-time">'+time+'</span><span class="log-type '+typeClass+'">'+l.type+'</span><span class="log-method">'+(l.method||'-')+'</span><span class="log-server">'+l.serverName+'</span>'+duration+'<span class="log-detail">'+escapeHtml(detail)+'</span></div>';
      }).join('');

      container.scrollTop = container.scrollHeight;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function showDetail(entry) {
      currentDetailEntry = entry;
      const panel = document.getElementById('detail-panel');
      const overlay = document.getElementById('detail-overlay');
      const body = document.getElementById('detail-body');

      const time = new Date(entry.timestamp).toLocaleString('zh-CN');
      let html = '';

      // 基本信息
      html += '<div class="detail-section">';
      html += '<div class="detail-section-title">基本信息</div>';
      html += '<div class="detail-info">';
      html += '<span class="detail-info-label">类型</span><span class="detail-info-value">' + entry.type + '</span>';
      html += '<span class="detail-info-label">方法</span><span class="detail-info-value">' + (entry.method || '-') + '</span>';
      html += '<span class="detail-info-label">Server</span><span class="detail-info-value">' + entry.serverName + '</span>';
      html += '<span class="detail-info-label">时间</span><span class="detail-info-value">' + time + '</span>';
      if (entry.duration) {
        html += '<span class="detail-info-label">耗时</span><span class="detail-info-value">' + entry.duration + 'ms</span>';
      }
      html += '</div></div>';

      // 参数/请求体
      if (entry.params !== undefined) {
        html += '<div class="detail-section">';
        html += '<div class="detail-section-title">参数 (Params)</div>';
        html += '<div class="detail-json">' + escapeHtml(JSON.stringify(entry.params, null, 2)) + '</div>';
        html += '</div>';
      }

      // 响应结果
      if (entry.result !== undefined) {
        html += '<div class="detail-section">';
        html += '<div class="detail-section-title">响应结果 (Result)</div>';
        html += '<div class="detail-json">' + escapeHtml(JSON.stringify(entry.result, null, 2)) + '</div>';
        html += '</div>';
      }

      // 错误信息
      if (entry.error) {
        html += '<div class="detail-section">';
        html += '<div class="detail-section-title">错误信息 (Error)</div>';
        html += '<div class="detail-json" style="color: var(--vscode-charts-red);">' + escapeHtml(JSON.stringify(entry.error, null, 2)) + '</div>';
        html += '</div>';
      }

      // 原始 JSON-RPC
      html += '<div class="detail-section">';
      html += '<div class="detail-section-title">原始消息</div>';
      html += '<div class="detail-json">' + escapeHtml(JSON.stringify(entry, null, 2)) + '</div>';
      html += '</div>';

      body.innerHTML = html;
      panel.classList.add('active');
      overlay.classList.add('active');
    }

    function closeDetail() {
      document.getElementById('detail-panel').classList.remove('active');
      document.getElementById('detail-overlay').classList.remove('active');
      currentDetailEntry = null;
    }

    function exportLogs() {
      vscode.postMessage({ command: 'exportLogs' });
    }

    function showLogDetail(entryId) {
      vscode.postMessage({ command: 'getLogDetail', data: { entryId } });
    }

    function toggleMonitoring(hostName, serverName, enable) {
      const command = enable ? 'enableMonitoring' : 'disableMonitoring';
      vscode.postMessage({ command, data: { hostName, serverName } });
    }

    function clearLogs() {
      vscode.postMessage({ command: 'clearLogs' });
      allLogs = [];
      renderLogs();
    }

    function refreshLogs() {
      vscode.postMessage({ command: 'getHosts' });
      vscode.postMessage({ command: 'getStats' });
      vscode.postMessage({ command: 'getLogs' });
    }

    document.getElementById('log-filter').addEventListener('input', (e) => {
      filterText = e.target.value;
      renderLogs();
    });
  </script>
</body>
</html>`;
  }

  /** 导出日志 */
  private async exportLogs(): Promise<void> {
    try {
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`mcp-debugger-logs-${new Date().toISOString().split('T')[0]}.jsonl`),
        filters: {
          'JSON Lines': ['jsonl'],
          'JSON': ['json'],
          'All Files': ['*']
        }
      });
      if (uri) {
        await this.monitoringService.exportLogs(uri.fsPath);
        vscode.window.showInformationMessage(`MCP Debugger: 日志已导出到 ${uri.fsPath}`);
      }
    } catch (err) {
      vscode.window.showErrorMessage(`MCP Debugger: 导出日志失败 - ${(err as Error).message}`);
    }
  }

  /** 发送日志详情 */
  private sendLogDetail(entryId: string): void {
    const logs = this.monitoringService.getLogs();
    const entry = logs.find(l => l.entryId === entryId);
    if (this.panel && entry) {
      this.panel.webview.postMessage({
        command: 'logDetail',
        data: entry
      });
    }
  }

  /** 获取扩展 URI */
  private getExtensionUri(): vscode.Uri {
    return (
      vscode.extensions.getExtension('mcp-debugger.mcp-debugger')?.extensionUri ??
      vscode.Uri.file(process.cwd())
    );
  }
}
