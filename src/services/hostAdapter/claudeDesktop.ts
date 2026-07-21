/**
 * Claude Desktop Host Adapter
 *
 * 配置文件位置:
 *   macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json
 *   Linux:   ~/.config/Claude/claude_desktop_config.json
 *   Windows: %USERPROFILE%\.config\Claude\claude_desktop_config.json
 */
import { getHostConfigPath } from '../../utils';
import { BaseHostAdapter } from './base';

export class ClaudeDesktopAdapter extends BaseHostAdapter {
  readonly name = 'claude-desktop';
  readonly displayName = 'Claude Desktop';
  readonly configPath = getHostConfigPath('claude-desktop');
}
