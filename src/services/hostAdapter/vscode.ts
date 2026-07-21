/**
 * VS Code Host Adapter
 *
 * 配置文件位置:
 *   工作区级: <workspace>/.vscode/mcp.json
 *   用户级:   ~/.vscode/mcp.json
 */
import * as path from 'path';
import { BaseHostAdapter } from './base';
import { fileExists } from '../../utils';

export class VSCodeAdapter extends BaseHostAdapter {
  readonly name = 'vscode';
  readonly displayName = 'VS Code';

  private readonly workspacePath?: string;
  private resolvedConfigPath?: string;

  /**
   * 配置文件路径
   */
  get configPath(): string {
    if (this.resolvedConfigPath) {
      return this.resolvedConfigPath;
    }
    return this.workspacePath
      ? path.join(this.workspacePath, '.vscode', 'mcp.json')
      : path.join(
          process.env.HOME || process.env.USERPROFILE || '',
          '.vscode',
          'mcp.json'
        );
  }

  /**
   * @param workspacePath - 当前工作区路径（可选）
   */
  constructor(workspacePath?: string) {
    super();
    this.workspacePath = workspacePath;
  }

  /**
   * 搜索配置文件
   *
   * 按优先级搜索：
   * 1. 工作区根目录下的 .vscode/mcp.json
   * 2. 用户主目录下的 .vscode/mcp.json
   */
  private async findConfigPath(): Promise<string | null> {
    const candidates: string[] = [];

    if (this.workspacePath) {
      candidates.push(path.join(this.workspacePath, '.vscode', 'mcp.json'));
    }

    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir) {
      candidates.push(path.join(homeDir, '.vscode', 'mcp.json'));
    }

    for (const candidate of candidates) {
      if (await fileExists(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  /** @inheritdoc */
  async isInstalled(): Promise<boolean> {
    const configPath = await this.findConfigPath();
    if (configPath) {
      this.resolvedConfigPath = configPath;
      console.log(`[MCP Debugger] VS Code config found: ${configPath}`);
      return true;
    }
    return false;
  }
}
