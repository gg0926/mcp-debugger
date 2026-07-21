/**
 * Cursor Host Adapter
 *
 * 配置文件位置: ~/.cursor/mcp.json
 */
import { getHostConfigPath } from '../../utils';
import { BaseHostAdapter } from './base';

export class CursorAdapter extends BaseHostAdapter {
  readonly name = 'cursor';
  readonly displayName = 'Cursor';
  readonly configPath = getHostConfigPath('cursor');
}
