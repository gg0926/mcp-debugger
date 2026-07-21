/**
 * Windsurf Host Adapter
 *
 * 配置文件位置: ~/.windsurf/mcp.json
 */
import { getHostConfigPath } from '../../utils';
import { BaseHostAdapter } from './base';

export class WindsurfAdapter extends BaseHostAdapter {
  readonly name = 'windsurf';
  readonly displayName = 'Windsurf';
  readonly configPath = getHostConfigPath('windsurf');
}
