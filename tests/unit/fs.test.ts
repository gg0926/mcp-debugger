/**
 * FS 工具单元测试
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileExists, readJsonFile, writeJsonFile, ensureDir } from '../../src/utils/fs';

describe('FS Utils', () => {
  const tempDir = path.join(os.tmpdir(), 'mcp-debugger-test-' + Date.now());

  beforeAll(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const testFile = path.join(tempDir, 'exists.txt');
      fs.writeFileSync(testFile, 'hello');
      expect(await fileExists(testFile)).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      const testFile = path.join(tempDir, 'not-exists.txt');
      expect(await fileExists(testFile)).toBe(false);
    });
  });

  describe('ensureDir', () => {
    it('should create directory if not exists', async () => {
      const dir = path.join(tempDir, 'new-dir');
      await ensureDir(dir);
      expect(fs.existsSync(dir)).toBe(true);
    });
  });

  describe('readJsonFile / writeJsonFile', () => {
    it('should write and read JSON file', async () => {
      const testFile = path.join(tempDir, 'data.json');
      const data = { name: 'test', value: 42 };
      await writeJsonFile(testFile, data);
      const read = await readJsonFile(testFile);
      expect(read).toEqual(data);
    });
  });
});
