/**
 * Cline Host Adapter
 *
 * 配置文件位置: ~/.cline/mcp_settings.json
 */
import { getHostConfigPath } from '../../utils';
import { BaseHostAdapter } from './base';

export class ClineAdapter extends BaseHostAdapter {
  readonly name = 'cline';
  readonly displayName = 'Cline';
  readonly configPath = getHostConfigPath('cline');
}
