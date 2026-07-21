/**
 * 跨平台工具函数
 *
 * 处理不同操作系统下的路径、IPC 等差异
 */
import * as os from 'os';
import * as path from 'path';

/**
 * 获取用户主目录
 */
export function getHomeDir(): string {
  return os.homedir();
}

/**
 * 获取 MCP Debugger 的数据目录
 *
 * Windows: %USERPROFILE%\.mcp-debugger
 * Unix:    ~/.mcp-debugger
 */
export function getDebuggerDir(): string {
  return path.join(getHomeDir(), '.mcp-debugger');
}

/**
 * 获取日志目录
 */
export function getLogDir(): string {
  return path.join(getDebuggerDir(), 'logs');
}

/**
 * 获取今日日志文件路径
 *
 * @param date - 日期，默认今天
 */
export function getDailyLogPath(date: Date = new Date()): string {
  const dateStr = date.toISOString().split('T')[0];
  return path.join(getLogDir(), `${dateStr}.jsonl`);
}

/**
 * 获取特定 Server 的日志文件路径
 *
 * @param serverName - Server 名称
 */
export function getServerLogPath(serverName: string): string {
  return path.join(getLogDir(), `${serverName}.jsonl`);
}

/**
 * 获取 IPC 通信通道路径
 *
 * Windows: \\.\pipe\mcp-debugger-<name>
 * Unix:    /tmp/mcp-debugger-<name>.sock
 *
 * @param name - 通道名称（通常是 Server 名称）
 */
export function getIPCPath(name: string): string {
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\mcp-debugger-${name}`;
  }
  return path.join(os.tmpdir(), `mcp-debugger-${name}.sock`);
}

/**
 * 获取 Host 配置文件路径
 *
 * @param host - Host 标识名
 */
export function getHostConfigPath(host: string): string {
  const home = getHomeDir();

  switch (host) {
    case 'claude-desktop':
      // macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
      // Linux/Windows: ~/.config/Claude/claude_desktop_config.json
      if (process.platform === 'darwin') {
        return path.join(
          home,
          'Library',
          'Application Support',
          'Claude',
          'claude_desktop_config.json'
        );
      }
      return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');

    case 'cursor':
      return path.join(home, '.cursor', 'mcp.json');

    case 'vscode':
      // VS Code 的工作区配置，需要在运行时确定工作区路径
      // 这里返回用户级配置作为默认值
      return path.join(home, '.vscode', 'mcp.json');

    case 'windsurf':
      return path.join(home, '.windsurf', 'mcp.json');

    case 'cline':
      return path.join(home, '.cline', 'mcp_settings.json');

    default:
      throw new Error(`Unknown host: ${host}`);
  }
}

/**
 * 获取当前操作系统类型
 */
export function getPlatform(): 'win32' | 'darwin' | 'linux' {
  if (process.platform === 'win32') {
    return 'win32';
  }
  if (process.platform === 'darwin') {
    return 'darwin';
  }
  return 'linux';
}

/**
 * 判断是否为 Windows
 */
export function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * 判断是否为 macOS
 */
export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

/**
 * 判断是否为 Linux
 */
export function isLinux(): boolean {
  return process.platform === 'linux';
}
