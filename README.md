# TNFronte

**A framework-agnostic visual frontend development tool.**

Edit any web project visually — React, Vue, Svelte, or plain HTML — with **zero vendor lock-in**. All changes write directly to your source code. No proprietary runtimes, no JSON schemas, no export step.

---

## ✨ What It Does

- 🎨 **Visual Canvas** — Click, drag, resize any element on the rendered page.
- ✏️ **Live Code Sync** — Every visual change is written back to your source files instantly. Edit code by hand and the canvas refreshes via HMR.
- 🔌 **Framework Agnostic** — Swap in the right adapter for React, Vue, Svelte, or vanilla HTML. The tool never forces a framework on your project.
- 📐 **Layer Tree** — Browse, reorder, show/hide, and lock elements in a layer panel.
- 🛠 **Property Panel** — Edit styles, attributes, text content, and event bindings with a dynamic form UI.
- 💻 **Code Editor** — Side-by-side Monaco editor with full IntelliSense, connected bidirectionally to the canvas.

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Editor UI (React 18)                                        │
│  Toolbar │ Canvas Viewport (iframe) │ Properties │ Layer Tree│
│          │   + Selection Overlay    │ Panel      │           │
│          │   + Monaco Code Panel    │            │           │
└────────────────────────────┬─────────────────────────────────┘
                      WebSocket │
┌─────────────────────────────▼────────────────────────────────┐
│  Editor Backend (Node.js / Fastify)                          │
│  Dev Server Manager │ Code Mod Engine │ OID Index            │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  Framework Adapter Registry                         │     │
│  │  React │ Vue │ Svelte │ HTML                        │     │
│  └─────────────────────────────────────────────────────┘     │
└────────────────────────────┬─────────────────────────────────┘
                             │ File System
┌─────────────────────────────▼────────────────────────────────┐
│  User Project (your code)                                    │
│  Runs in an <iframe> with a lightweight Bridge script        │
│  injected by the Vite/Webpack plugin at dev time only.       │
└──────────────────────────────────────────────────────────────┘
```

### How It Works

1. **OID Injection** — A Vite (or Webpack) plugin parses your source files via AST and injects `data-oid` attributes onto every DOM element. These attributes act as source-maps, linking each rendered element back to its exact location in your code.

2. **Bridge Communication** — A small runtime script injected into your project's `<iframe>` captures user interactions (click, hover, drag) and relays them to the Editor UI via `postMessage`.

3. **Code Mod Engine** — When you modify an element visually, the backend receives an `Action`, looks up the OID → source-location mapping, navigates the AST to the exact node, applies the change, formats with Prettier, and writes the file back.

4. **HMR Round-trip** — The dev server detects the file change, triggers Hot Module Replacement, and the canvas updates. The Bridge confirms the DOM update. Cycle complete.

> 💡 The injected `data-oid` attributes and Bridge script are **dev-only**. They never ship to production.

## 📦 Monorepo Structure

```
tnfronte/
├── apps/
│   ├── editor/                # Editor UI (React 18 + Vite)
│   └── server/                # Editor Backend (Fastify)
├── packages/
│   ├── shared/                # Types, interfaces, protocol definitions
│   ├── bridge/                # Runtime script injected into user iframe
│   ├── code-mod/              # AST-based code modification engine
│   ├── oid-index/             # OID → source-location mapping table
│   ├── dev-server/            # Vite plugin (+ future Webpack plugin)
│   └── adapters/
│       ├── react-adapter/     # React JSX/TSX OID injection + code mod
│       ├── vue-adapter/       # Vue SFC OID injection + code mod
│       ├── svelte-adapter/    # Svelte OID injection + code mod
│       └── html-adapter/      # Vanilla HTML OID injection + code mod
├── docs/                      # Project documentation
├── turbo.json                 # Turborepo task configuration
├── pnpm-workspace.yaml        # pnpm workspace definition
└── tsconfig.base.json         # Shared TypeScript config
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **pnpm** ≥ 9 (`npm i -g pnpm`)

### Install & Run

```bash
# Clone the repository
git clone https://github.com/<your-username>/tnfronte.git
cd tnfronte

# Install dependencies
pnpm install

# Start all packages in dev mode
pnpm dev
```

### Build

```bash
pnpm build
```

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Editor UI** | React 18, TypeScript, TailwindCSS, Zustand |
| **Code Editor** | Monaco Editor |
| **Canvas** | iframe + custom Selection Overlay |
| **Drag & Drop** | @dnd-kit |
| **Backend** | Fastify, TypeScript |
| **AST (React)** | @babel/parser, @babel/traverse, recast |
| **AST (Vue)** | @vue/compiler-sfc, parse5 |
| **AST (Svelte)** | svelte/compiler |
| **Formatting** | Prettier |
| **Dev Server** | Vite Plugin API |
| **Monorepo** | Turborepo + pnpm workspaces |

## 📋 Roadmap

### Phase 1 — Core (React MVP)

- [ ] React adapter: OID injection via Babel
- [ ] Bridge script: select, hover, drag
- [ ] Vite plugin: transform + HTML injection
- [ ] Editor canvas with selection overlay
- [ ] Code Mod Engine: style + prop modifications
- [ ] Prettier integration for formatted output
- [ ] Property panel + layer tree
- [ ] Undo / Redo (Command Pattern)

### Phase 2 — Code Sync

- [ ] Monaco Editor integration
- [ ] Code → Canvas bidirectional sync
- [ ] Keyboard shortcuts (Ctrl+Z/Y, Delete, Ctrl+C/V)

### Phase 3 — Multi-Framework

- [ ] Vue SFC adapter
- [ ] Svelte adapter
- [ ] HTML adapter
- [ ] Auto-detect project framework

### Phase 4 — Advanced Features

- [ ] CSS source analysis (Tailwind, CSS Modules, inline)
- [ ] List rendering support (.map items)
- [ ] Component library panel (drag new elements onto canvas)
- [ ] Export to multiple formats
- [ ] Responsive preview (multi-device canvas)

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines (coming soon) before submitting a PR.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## 📄 License

[MIT](./LICENSE)

---

> **TNFronte** — *Visual editing that respects your code.*
