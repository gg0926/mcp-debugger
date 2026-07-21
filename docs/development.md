# 开发指南

## 一、环境准备

### 1.1 必需软件

- **Node.js** >= 18（推荐 20 LTS 或更高）
- **npm** >= 9
- **VS Code** >= 1.90.0
- **Git**

验证安装：

```bash
node --version
npm --version
git --version
```

### 1.2 推荐 VS Code 扩展

- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- TypeScript Next (`ms-vscode.vscode-typescript-next`)

## 二、项目初始化

### 2.1 克隆并安装依赖

```bash
git clone <repository-url>
cd mcp-debugger
npm install
```

### 2.2 项目结构

详见 [架构文档](./architecture.md)。

## 三、常用命令

### 3.1 构建

```bash
# 完整构建（扩展 + WebView）
npm run build

# 仅构建扩展
npm run build:extension

# 仅构建 WebView
npm run build:webview
```

### 3.2 开发模式（监听文件变化）

```bash
# 同时监听扩展和 WebView
npm run watch

# 仅监听扩展
npm run watch:extension

# 仅监听 WebView
npm run watch:webview
```

### 3.3 代码检查

```bash
# 运行 ESLint
npm run lint

# 自动修复
npm run lint:fix

# 格式化代码
npm run format
```

### 3.4 类型检查

```bash
npm run compile
```

### 3.5 测试

```bash
# 运行单元测试
npm run test:unit

# 运行测试并生成覆盖率报告
npm run test:unit -- --coverage
```

### 3.6 打包发布

```bash
# 打包为 .vsix
npm run package

# 发布到 VS Code Marketplace
npm run publish
```

## 四、调试扩展

### 4.1 启动调试

1. 用 VS Code 打开项目
2. 按 `F5`（或选择调试配置 "Run Extension"）
3. VS Code 会自动构建并启动一个新的 Extension Development Host 窗口
4. 在新窗口中测试扩展功能

### 4.2 调试配置

调试配置位于 `.vscode/launch.json`：

- **Run Extension**: 启动扩展调试
- **Extension Tests**: 运行扩展集成测试

### 4.3 查看日志

- 扩展日志：在 Extension Development Host 中打开 Output 面板，选择 "Log (Extension Host)"
- 调试日志：在主窗口的 Debug Console 中查看

## 五、编码规范

### 5.1 TypeScript 规范

- 严格模式启用（`strict: true`）
- 文件命名：kebab-case（如 `host-adapter.ts`）
- 类型/接口名：PascalCase（如 `HostAdapter`）
- 函数/变量名：camelCase（如 `readConfig`）
- 接口不加 `I` 前缀
- 所有导出的函数、类、接口必须有 JSDoc 注释

### 5.2 代码格式化

使用 Prettier 统一格式，配置见 `.prettierrc`：

```json
{
  "semi": true,
  "trailingComma": "none",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### 5.3 提交规范

遵循 Conventional Commits：

```
feat:     新功能
fix:      修复 bug
docs:     文档变更
style:    格式变更
refactor: 重构
perf:     性能优化
test:     增加测试
chore:    构建/辅助工具变动
```

示例：
```
feat: add ClaudeDesktop host adapter
fix: correct windsurf config path
docs: update architecture diagram
```

## 六、添加新的 Host Adapter

以添加一个新的 Host "Foobar" 为例：

### 6.1 创建适配器文件

创建 `src/services/hostAdapter/foobar.ts`：

```typescript
import { getHostConfigPath } from '../../utils';
import { BaseHostAdapter } from './base';

export class FoobarAdapter extends BaseHostAdapter {
  readonly name = 'foobar';
  readonly displayName = 'Foobar';
  readonly configPath = getHostConfigPath('foobar');
}
```

### 6.2 添加路径配置

在 `src/utils/platform.ts` 的 `getHostConfigPath` 函数中添加：

```typescript
case 'foobar':
  return path.join(home, '.foobar', 'mcp.json');
```

### 6.3 注册到 HostManager

在 `src/services/hostManager.ts` 中添加：

```typescript
import { FoobarAdapter } from './hostAdapter';

// 在构造函数中
this.registerAdapter(new FoobarAdapter());
```

### 6.4 导出

在 `src/services/hostAdapter/index.ts` 中添加：

```typescript
export * from './foobar';
```

### 6.5 测试

编写单元测试验证适配器的 `readConfig`、`writeConfig` 等方法。

## 七、测试指南

### 7.1 单元测试

- 位置：`tests/unit/`
- 命名：`<module>.test.ts`
- 运行：`npm run test:unit`

示例：

```typescript
import { parseJsonRpc } from '../../src/utils/jsonrpc';

describe('parseJsonRpc', () => {
  test('should parse valid JSON-RPC message', () => {
    const content = '{"jsonrpc":"2.0","id":1,"method":"tools/call"}';
    const msg = parseJsonRpc(content);
    expect(msg?.method).toBe('tools/call');
  });
});
```

### 7.2 集成测试

- 位置：`tests/integration/`
- 使用 `@vscode/test-electron` 运行

## 八、常见问题

### Q: 构建失败提示 "Cannot find module 'vscode'"

A: 这是正常现象，`vscode` 模块由 VS Code 运行时提供，不需要安装。确保 `@types/vscode` 已在 devDependencies 中。

### Q: WebView 不显示内容

A: 检查：
1. `npm run build:webview` 是否成功
2. `dist/webview.js` 和 `dist/webview.html` 是否存在
3. WebView 的 `localResourceRoots` 配置是否正确

### Q: 扩展无法激活

A: 检查：
1. `package.json` 的 `main` 字段是否指向 `./dist/extension.js`
2. `npm run build:extension` 是否成功
3. `activationEvents` 是否正确配置
