# TNFronte

[English](./README.md) | [简体中文](./README-CN.md)

**一个与框架无关的可视化前端开发工具。**

以可视化方式编辑任何 Web 项目，无论是 React、Vue、Svelte 还是原生 HTML，都可以做到 **零厂商锁定**。所有改动都会直接写回你的源代码。没有私有运行时，没有 JSON 配置模式，也不需要额外导出步骤。

---

## ✨ 项目能力

- 🎨 **可视化画布**：在渲染后的页面中直接点击、拖拽、调整元素尺寸。
- ✏️ **代码实时同步**：每一次可视化修改都会立刻写回源文件。你手动修改代码后，画布也会通过 HMR 实时刷新。
- 🔌 **框架无关**：可按需接入 React、Vue、Svelte 或原生 HTML 适配器，工具本身不会强制绑定某一种框架。
- 📐 **图层树**：在图层面板中浏览、排序、显示/隐藏、锁定页面元素。
- 🛠 **属性面板**：通过动态表单编辑样式、属性、文本内容和事件绑定。
- 💻 **代码编辑器**：支持与画布双向联动的 Monaco 编辑器与智能提示。

## 🏗 架构

```text
┌──────────────────────────────────────────────────────────────┐
│  编辑器前端 (React 18)                                      │
│  Toolbar │ Canvas Viewport (iframe) │ Properties │ Layer Tree│
│          │   + Selection Overlay    │ Panel      │           │
│          │   + Monaco Code Panel    │            │           │
└────────────────────────────┬─────────────────────────────────┘
                      WebSocket │
┌─────────────────────────────▼────────────────────────────────┐
│  编辑器后端 (Node.js / Fastify)                              │
│  Dev Server Manager │ Code Mod Engine │ OID Index            │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  框架适配器注册表                                   │     │
│  │  React │ Vue │ Svelte │ HTML                        │     │
│  └─────────────────────────────────────────────────────┘     │
└────────────────────────────┬─────────────────────────────────┘
                             │ File System
┌─────────────────────────────▼────────────────────────────────┐
│  用户项目（你的代码）                                        │
│  在 iframe 中运行，并在开发环境下由 Vite/Webpack 插件注入   │
│  一个轻量级 Bridge 脚本。                                   │
└──────────────────────────────────────────────────────────────┘
```

### 工作原理

1. **OID 注入**：Vite 或 Webpack 插件会通过 AST 解析源文件，为每个 DOM 元素注入 `data-oid` 属性。这些属性充当源码映射，把渲染后的元素和代码中的精确位置关联起来。
2. **Bridge 通信**：注入到项目 `iframe` 中的小型运行时脚本会捕获点击、悬停、拖拽等交互，并通过 `postMessage` 把消息发回编辑器前端。
3. **代码修改引擎**：当你在可视化界面里修改元素时，后端会接收一个 `Action`，根据 OID 找到源码位置，定位到对应 AST 节点，执行修改，并使用 Prettier 重新格式化后写回文件。
4. **HMR 回路**：开发服务器检测到文件变化后触发热更新，画布同步刷新；Bridge 再确认 DOM 已更新，完成一次编辑闭环。

> 注：注入的 `data-oid` 属性和 Bridge 脚本仅在开发环境存在，不会进入生产环境。

## 📦 Monorepo 结构

```text
tnfronte/
├─ apps/
│  ├─ editor/                # 编辑器前端（React 18 + Vite）
│  └─ server/                # 编辑器后端（Fastify）
├─ packages/
│  ├─ shared/                # 类型、接口、协议定义
│  ├─ bridge/                # 注入到用户 iframe 内的运行时脚本
│  ├─ code-mod/              # 基于 AST 的代码修改引擎
│  ├─ oid-index/             # OID 到源码位置的映射表
│  ├─ dev-server/            # Vite 插件（后续可扩展 Webpack 插件）
│  └─ adapters/
│     ├─ react-adapter/      # React JSX/TSX 的 OID 注入与代码修改
│     ├─ vue-adapter/        # Vue SFC 的 OID 注入与代码修改
│     ├─ svelte-adapter/     # Svelte 的 OID 注入与代码修改
│     └─ html-adapter/       # 原生 HTML 的 OID 注入与代码修改
├─ test-fixture/             # 用于验证编辑链路的示例项目
├─ tests/                    # 测试脚本
├─ turbo.json                # Turborepo 任务配置
├─ pnpm-workspace.yaml       # pnpm workspace 定义
└─ tsconfig.base.json        # 共享 TypeScript 配置
```

## 🚀 快速开始

### 前置要求

- **Node.js** >= 18
- **pnpm** >= 9（可通过 `npm i -g pnpm` 安装）

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/<your-username>/tnfronte.git
cd tnfronte

# 安装依赖
pnpm install

# 启动所有包的开发模式
pnpm dev
```

### 构建

```bash
pnpm build
```

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| **编辑器前端** | React 18, TypeScript, TailwindCSS, Zustand |
| **代码编辑器** | Monaco Editor |
| **画布** | iframe + 自定义 Selection Overlay |
| **拖拽交互** | @dnd-kit |
| **后端** | Fastify, TypeScript |
| **AST (React)** | @babel/parser, @babel/traverse, recast |
| **AST (Vue)** | @vue/compiler-sfc, parse5 |
| **AST (Svelte)** | svelte/compiler |
| **格式化** | Prettier |
| **开发服务器** | Vite Plugin API |
| **Monorepo** | Turborepo + pnpm workspaces |

## 📋 路线图

### Phase 1 — 核心能力（React MVP）

- [ ] React 适配器：基于 Babel 注入 OID
- [ ] Bridge 脚本：支持选择、悬停、拖拽
- [ ] Vite 插件：transform 与 HTML 注入
- [ ] 带选区覆盖层的编辑画布
- [ ] Code Mod Engine：支持样式和属性修改
- [ ] 接入 Prettier，保证输出格式一致
- [ ] 属性面板与图层树
- [ ] Undo / Redo（命令模式）

### Phase 2 — 代码同步

- [ ] 集成 Monaco Editor
- [ ] 代码到画布的双向同步
- [ ] 键盘快捷键（Ctrl+Z/Y、Delete、Ctrl+C/V）

### Phase 3 — 多框架支持

- [ ] Vue SFC 适配器
- [ ] Svelte 适配器
- [ ] HTML 适配器
- [ ] 自动识别项目框架

### Phase 4 — 高级特性

- [ ] CSS 来源分析（Tailwind、CSS Modules、inline）
- [ ] 列表渲染支持（`.map` 等场景）
- [ ] 组件库面板（把新元素拖到画布中）
- [ ] 导出到多种格式
- [ ] 响应式预览（多设备画布）

## 🤝 贡献

欢迎贡献代码。提交 PR 之前，请先阅读贡献指南（后续补充）。

1. Fork 本仓库
2. 新建功能分支：`git checkout -b feat/amazing-feature`
3. 提交修改：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feat/amazing-feature`
5. 发起 Pull Request

## 📄 许可证

[MIT](./LICENSE)

---

> **TNFronte**：尊重源码的可视化编辑。
