/**
 * 监控服务
 *
 * 统一管理 IPC 服务器、日志分析器和 Host Adapter，提供完整的监控生命周期管理。
 *
 * 职责：
 *   1. 启动/停止 IPC 服务器
 *   2. 启用/禁用特定 Host 的 Server 监控
 *   3. 将 IPC 消息路由到 LogAnalyzer
 *   4. 提供 UI 所需的数据接口
 */
import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { HostManager, IpcServer, LogAnalyzer } from './index';
import { getWrapperPath } from './hostAdapter/base';

/** 监控服务事件 */
export interface MonitoringServiceEvents {
  /** 日志更新 */
  log: (entry: import('../models/logEntry').LogEntry) => void;
  /** 监控状态变化 */
  stateChange: (serverName: string, enabled: boolean) => void;
  /** Wrapper 连接 */
  wrapperConnected: (serverName: string) => void;
  /** Wrapper 断开 */
  wrapperDisconnected: (serverName: string) => void;
  /** 错误诊断 */
  diagnosis: (entry: import('../models/logEntry').LogEntry, diagnosis: string) => void;
}

/**
 * 监控服务
 */
export class MonitoringService extends EventEmitter {
  private ipcServer: IpcServer;
  private logAnalyzer: LogAnalyzer;
  private hostManager: HostManager;
  private context: vscode.ExtensionContext;
  private monitoringEnabled: Set<string> = new Set();

  constructor(context: vscode.ExtensionContext, hostManager: HostManager) {
    super();
    this.context = context;
    this.hostManager = hostManager;
    this.ipcServer = new IpcServer();
    this.logAnalyzer = new LogAnalyzer();

    this.setupEventHandlers();
  }

  /** 初始化（启动 IPC 服务器） */
  async initialize(): Promise<void> {
    await this.ipcServer.start();
    console.log(`[MCP Debugger] IPC server listening on: ${this.ipcServer.getPipePath()}`);
  }

  /** 设置事件处理 */
  private setupEventHandlers(): void {
    // IPC 消息 -> LogAnalyzer
    this.ipcServer.on('message', (msg) => {
      this.logAnalyzer.processMessage(msg);
    });

    // LogAnalyzer -> 事件转发
    this.logAnalyzer.on('log', (entry) => {
      this.emit('log', entry);
    });

    this.logAnalyzer.on('error', (entry, diagnosis) => {
      this.emit('diagnosis', entry, diagnosis);
    });

    // Wrapper 连接/断开
    this.ipcServer.on('connected', (serverName) => {
      this.emit('wrapperConnected', serverName);
    });

    this.ipcServer.on('disconnected', (serverName) => {
      this.emit('wrapperDisconnected', serverName);
    });
  }

  /** 启用对指定 Server 的监控 */
  async enableMonitoring(hostName: string, serverName: string): Promise<void> {
    const adapter = this.hostManager.getAdapter(hostName);
    if (!adapter) {
      throw new Error(`Host '${hostName}' not found`);
    }

    const wrapperPath = getWrapperPath(this.context.extensionPath);
    const ipcEndpoint = this.ipcServer.getPipePath();

    await adapter.injectWrapper(serverName, wrapperPath, ipcEndpoint);
    this.monitoringEnabled.add(`${hostName}:${serverName}`);
    this.emit('stateChange', serverName, true);

    vscode.window.showInformationMessage(
      `MCP Debugger: 已启用监控 ${serverName}（重启 ${adapter.displayName} 后生效）`
    );
  }

  /** 禁用对指定 Server 的监控 */
  async disableMonitoring(hostName: string, serverName: string): Promise<void> {
    const adapter = this.hostManager.getAdapter(hostName);
    if (!adapter) {
      throw new Error(`Host '${hostName}' not found`);
    }

    await adapter.removeWrapper(serverName);
    this.monitoringEnabled.delete(`${hostName}:${serverName}`);
    this.emit('stateChange', serverName, false);

    vscode.window.showInformationMessage(
      `MCP Debugger: 已禁用监控 ${serverName}（重启 ${adapter.displayName} 后生效）`
    );
  }

  /** 检查是否已启用监控 */
  isMonitoringEnabled(hostName: string, serverName: string): boolean {
    return this.monitoringEnabled.has(`${hostName}:${serverName}`);
  }

  /** 获取 IPC 端点路径 */
  getIpcEndpoint(): string {
    return this.ipcServer.getPipePath();
  }

  /** 获取日志分析器 */
  getLogAnalyzer(): LogAnalyzer {
    return this.logAnalyzer;
  }

  /** 获取所有日志 */
  getLogs() {
    return this.logAnalyzer.getLogs();
  }

  /** 获取统计信息 */
  getStats() {
    return this.logAnalyzer.getStats();
  }

  /** 获取已连接的 Wrapper 列表 */
  getConnectedWrappers(): string[] {
    return this.ipcServer.getConnectedWrappers();
  }

  /** 清空日志 */
  clearLogs(): void {
    this.logAnalyzer.clear();
  }

  /** 导出日志 */
  async exportLogs(filePath: string): Promise<void> {
    await this.logAnalyzer.exportLogs(filePath);
  }

  /** 获取日志文件路径 */
  getLogFilePath(): string {
    return this.logAnalyzer.getLogFilePath();
  }

  /** 销毁服务 */
  async dispose(): Promise<void> {
    await this.ipcServer.stop();
  }
}
