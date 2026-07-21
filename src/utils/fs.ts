/**
 * 文件系统工具函数
 */
import * as fs from 'fs';
import * as path from 'path';

/**
 * 确保目录存在，不存在则递归创建
 *
 * @param dirPath - 目录路径
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

/**
 * 读取 JSON 文件
 *
 * @param filePath - 文件路径
 * @returns 解析后的 JSON 对象
 * @throws 文件不存在或 JSON 解析失败时抛出错误
 */
export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * 写入 JSON 文件（自动格式化）
 *
 * @param filePath - 文件路径
 * @param data - 要写入的对象
 * @param spaces - 缩进空格数，默认 2
 */
export async function writeJsonFile(
  filePath: string,
  data: unknown,
  spaces: number = 2
): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const content = JSON.stringify(data, null, spaces);
  await fs.promises.writeFile(filePath, content, 'utf-8');
}

/**
 * 检查文件是否存在
 *
 * @param filePath - 文件路径
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 备份文件
 *
 * @param filePath - 原文件路径
 * @param suffix - 备份文件后缀，默认 '.backup'
 */
export async function backupFile(filePath: string, suffix: string = '.backup'): Promise<void> {
  if (await fileExists(filePath)) {
    const backupPath = filePath + suffix;
    await fs.promises.copyFile(filePath, backupPath);
  }
}

/**
 * 追加写入一行到文件
 *
 * @param filePath - 文件路径
 * @param line - 要追加的行内容
 */
export async function appendLine(filePath: string, line: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.promises.appendFile(filePath, line + '\n', 'utf-8');
}
