/**
 * MCP Debugger - Wrapper 进程 Webpack 配置
 *
 * 负责打包 src/wrapper/wrapper.ts 为独立可执行文件 dist/wrapper.js
 * Wrapper 作为独立 Node.js 进程运行，由 Host 启动
 */
const path = require('path');

/** @type {import('webpack').Configuration} */
const config = {
  target: 'node',
  entry: './src/wrapper/wrapper.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'wrapper.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    // 不要打包 vscode 模块，wrapper 不依赖它
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.json'
            }
          }
        ]
      }
    ]
  }
};

module.exports = config;
