<div align="center">

# TypeLearn
![alt text](image.png)

### 每一次敲键都能学英文。

一款隐私优先的 macOS 菜单栏应用，把你的日常输入转化为持续、轻量的语言学习。

[![macOS](https://img.shields.io/badge/macOS-12%2B-000000?style=flat&logo=apple&logoColor=white)](#)
[![Swift](https://img.shields.io/badge/Swift-6-F05138?style=flat&logo=swift&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat&logo=typescript&logoColor=white)](#)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat&logo=node.js&logoColor=white)](#)
[![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-888?style=flat)](#)

<br/>

**TypeLearn 会安静地观察你的输入，识别学习时刻，帮助你提升词汇、表达与措辞 —— 全程不打断你的工作流。**

<br/>

[快速开始](#快速开始) · [架构](#架构) · [API参考](#api参考) · [隐私](#隐私)

</div>

<br/>

## 为什么是 TypeLearn？

大多数语言学习工具都要求你专门抽时间学习。TypeLearn 选择另一条路径：在你已经在做的事情上学习 —— 在键盘上。

> **自然输入，持续学习，保持专注。**

<br/>

## 功能

| | 功能 | 说明 |
|---|------|------|
| **⌨️** | **环境式学习** | 从真实输入中学习 —— 无需背单词卡、无需独立学习时间 |
| **📍** | **菜单栏原生** | 常驻 macOS 菜单栏，随时可用 |
| **🔒** | **隐私优先** | 默认全程本地处理 —— 未经明确同意不出设备 |
| **🌐** | **多语言捕捉** | 识别中文输入并翻译为英文以支持跨语言学习 |
| **✏️** | **语法教练** | 发现常见错误并给出清晰的改进建议 |
| **📖** | **每日故事** | 用你当天的写作生成故事，强化学习 |
| **🔑** | **自带密钥** | 连接任意 OpenAI 兼容 API 以获得更强 AI 能力 |

<br/>

## 快速开始

### 前置条件

| 需求 | 版本 |
|------|------|
| macOS | 12+ |
| Node.js | 18+ |
| Xcode | 最新 |

首次启动时会提示 **辅助功能** 与 **输入监控** 权限。

### 快速启动

```bash
# Clone & install
git clone https://github.com/your-username/TypeLearn.git
cd TypeLearn && npm install

# Build all workspaces
npm run build

# Start the orchestration service
npm run dev:service
# → http://127.0.0.1:43010
```

然后在 Xcode 中打开 `macos/TypeLearn.xcodeproj`，点击 **Run** 即可启动菜单栏应用。

<br/>

## 架构

```
                         TypeLearn
    ┌────────────────────────┼────────────────────────┐
    │                        │                        │
    ▼                        ▼                        ▼
 ┌──────┐              ┌─────────┐              ┌────────┐
 │macOS │  ◄─ HTTP ──► │ Service │  ◄─ types ─► │ Shared │
 └──────┘              └─────────┘              └────────┘
  SwiftUI               Node.js                TypeScript
  Menu Bar              :43010                  Interfaces
```

<details>
<summary><b>工作原理</b></summary>

<br/>

```
 你输入 → CaptureMonitor 识别输入 → 暂停时写入缓冲区
                                                    │
                                                    ▼
                                          POST /artifacts
                                                    │
                                                    ▼
                                     ┌──────────────────────────┐
                                     │     编排服务（Service）    │
                                     │                          │
                                     │  1. 识别语言             │
                                     │  2. 必要时翻译           │
                                     │  3. 应用语法规则         │
                                     │  4. 生成学习条目         │
                                     │  5. 持久化到本地         │
                                     └──────────────────────────┘
                                                    │
                                                    ▼
                                          学习条目
                                         在 UI 中展示
```

</details>

### Monorepo 结构

```
TypeLearn/
│
├─ macos/                        # SwiftUI macOS App
│  └─ TypeLearn/
│     ├─ TypeLearnApp.swift         App entry point (MenuBarExtra)
│     ├─ ContentView.swift          Tabbed UI — Dashboard / Learn / Settings
│     ├─ AppModel.swift             Root observable view model
│     ├─ CaptureMonitor.swift       Global keyboard event tap
│     ├─ AXTextCapture.swift        Accessibility API for IME text
│     └─ ServiceClient.swift        HTTP client to local service
│
├─ service/                      # Node.js Orchestration Service
│  └─ src/
│     ├─ index.ts                   HTTP server & routing
│     ├─ store.ts                   Core data management (LearningStore)
│     ├─ coaching.ts                Grammar rules & suggestion engine
│     ├─ story.ts                   Daily story generation
│     ├─ translator.ts              Language detection & translation
│     ├─ persistence.ts             State persistence (~/.typelearn/)
│     └─ provider.ts                Provider abstraction layer
│
├─ shared/                       # Shared Type Definitions
│  └─ src/
│     └─ index.ts                   LearningArtifact, CaptureRecord, etc.
│
├─ package.json                  # npm workspace root
├─ tsconfig.base.json            # Shared TypeScript config
└─ PRODUCT.md                    # Product vision & strategy
```

<br/>

## 开发

```bash
npm run build           # Build all workspaces
npm run dev:service     # Start service in dev mode
npm run typecheck       # Type-check everything
npm run test            # Run test suite
```

<details>
<summary><b>Workspace 专用命令</b></summary>

<br/>

```bash
# Service
npm run build  --workspace service
npm run dev    --workspace service
npm run test   --workspace service

# Shared types
npm run build  --workspace shared
```

</details>

<br/>

## API参考

编排服务运行在 `http://127.0.0.1:43010`。

<details open>
<summary><b>Endpoints</b></summary>

<br/>

| Method | Endpoint | Description |
|:------:|----------|-------------|
| `GET` | `/health` | Health check & provider status |
| `GET` | `/artifacts` | List learning artifacts |
| `GET` | `/records` | List captured text records |
| `GET` | `/stories` | List generated daily stories |
| `GET` | `/settings` | Retrieve provider settings |
| `POST` | `/artifacts` | Submit text for artifact generation |
| `POST` | `/stories/generate` | Generate daily story from captures |
| `PUT` | `/settings` | Update provider settings |
| `DELETE` | `/records/:id` | Delete a capture record |

</details>

<br/>

## 隐私

TypeLearn 建立在严格的隐私模型之上 —— 你的输入只属于你。

```
┌─────────────────────────────────────────────────────────┐
│                    Your Mac (local)                      │
│                                                         │
│   Typing ──► Capture ──► Process ──► ~/.typelearn/      │
│                                                         │
│   ❌ No telemetry    ❌ No cloud sync    ❌ No tracking  │
└─────────────────────────────────────────────────────────┘
                          │
                 Only if YOU configure it
                          │
                          ▼
                 ┌─────────────────┐
                 │  Your API Key   │
                 │  Your Provider  │
                 └─────────────────┘
```

| 模式 | 说明 | 远程调用 |
|------|------|:-------:|
| **本地** *(默认)* | 全部本地处理 | 无 |
| **BYOK Remote** | 自带 API Key | 仅你的 provider |
| **自定义端点** | 指向任意 OpenAI 兼容 API | 仅你的端点 |

- 所有数据本地保存在 `~/.typelearn/state.json`
- AI 功能（翻译、故事生成）为 **可选**，需明确配置 provider
- 不会向 TypeLearn 开发者共享任何数据

<br/>

## 技术栈

| 层 | 技术 | 作用 |
|----|------|------|
| **前端** | Swift 6, SwiftUI | 菜单栏应用、键盘捕捉、UI |
| **后端** | TypeScript, Node.js | 编排、NLP、持久化 |
| **构建** | npm workspaces, tsc | Monorepo 管理 |
| **持久化** | JSON (local file) | `~/.typelearn/state.json` |
| **进程通信** | HTTP (localhost) | App ↔ Service 通信 |

<br/>

## Roadmap

- [x] macOS 菜单栏外壳与权限管理
- [x] 隐私友好的键盘捕捉（CGEvent + Accessibility）
- [x] 语法教练与学习条目生成
- [x] 本地持久化与回顾 UI
- [x] Provider 抽象（local / BYOK / custom）
- [x] 中文 → 英文翻译管线
- [x] 每日故事生成
- [ ] 更强的噪声过滤与捕捉质量
- [ ] 更丰富的上下文改写建议
- [ ] 学习条目的间隔复习
- [ ] 导出与备份功能

<br/>

## License

All rights reserved.

<div align="center">
<sub>为隐私与语言学习体验用心打造。</sub>
</div>
