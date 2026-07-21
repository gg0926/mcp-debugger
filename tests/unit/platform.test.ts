/**
 * 平台工具单元测试
 */
import * as os from 'os';
import * as path from 'path';
import { getHomeDir, getIPCPath, getHostConfigPath, isWindows } from '../../src/utils/platform';

describe('Platform Utils', () => {
  describe('getHomeDir', () => {
    it('should return user home directory', () => {
      expect(getHomeDir()).toBe(os.homedir());
    });
  });

  describe('getIPCPath', () => {
    it('should generate Windows named pipe path', () => {
      if (process.platform === 'win32') {
        const result = getIPCPath('test');
        expect(result).toBe('\\\\.\\pipe\\mcp-debugger-test');
      }
    });

    it('should generate Unix socket path', () => {
      if (process.platform !== 'win32') {
        const result = getIPCPath('test');
        expect(result).toContain('mcp-debugger-test.sock');
      }
    });
  });

  describe('getHostConfigPath', () => {
    it('should return cursor config path', () => {
      const result = getHostConfigPath('cursor');
      expect(result).toContain('.cursor');
      expect(result).toContain('mcp.json');
    });

    it('should return cline config path', () => {
      const result = getHostConfigPath('cline');
      expect(result).toContain('.cline');
    });

    it('should throw for unknown host', () => {
      expect(() => getHostConfigPath('unknown')).toThrow('Unknown host');
    });
  });

  describe('isWindows', () => {
    it('should return boolean', () => {
      expect(typeof isWindows()).toBe('boolean');
    });
  });
});
