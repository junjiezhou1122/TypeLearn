<div align="center">

# TypeLearn
![alt text](image.png)

### 每一次敲键都能学英文 —— 在一条轻盈的日历丝带里回顾。

TypeLearn 是一套隐私优先的本地学习系统，包含本地服务与 Web UI。它把日常输入变成可滑动的学习时间线，安静、克制、不中断。

[![macOS](https://img.shields.io/badge/macOS-12%2B-000000?style=flat&logo=apple&logoColor=white)](#)
[![Swift](https://img.shields.io/badge/Swift-6-F05138?style=flat&logo=swift&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat&logo=typescript&logoColor=white)](#)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat&logo=node.js&logoColor=white)](#)
[![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-888?style=flat)](#)

<br/>

**TypeLearn 会安静地观察你的输入，识别学习时刻，并用“日历丝带”式的时间线呈现 —— 不打断你的工作流。**

<br/>

[快速开始](#快速开始) · [架构](#架构) · [API 参考](#api-参考) · [隐私](#隐私) · [English](README.md)

</div>

<br/>

## 产品定位

大多数语言学习工具需要专门时间。TypeLearn 选择另一条路径：在你已经在做的事情上学习 —— 在键盘上。

> **自然输入，持续学习，保持专注。**

<br/>

## 当前版本包含

| 功能 | 说明 |
|---|---|
| 日历丝带收件箱 | 横向日历条让你专注当日，同时可以滑动查看其他天 |
| 学习条目 | 基于真实输入生成改写、纠错与解释 |
| Choices 流程 | 为不确定的拼音或混合输入提供候选选择 |
| Daily Lesson | 语言模式分组与每日总结 |
| Daily Story | 根据当天写作生成故事 |
| 本地服务 | Node.js 本地编排与持久化、重试队列 |
| BYOK Provider | 可选 OpenAI 兼容 Provider 配置 |

<br/>

## 体验流程概览

1. 输入通过本地服务接口提交（`POST /artifacts`）。
2. 服务完成片段组装、拼音还原、学习条目生成。
3. Web UI 以玻璃感 Inbox 呈现，并提供日历丝带与筛选（All / English / Chinese）。
4. 必要时出现 Choices 与 Daily Lesson。

<br/>

## 仓库结构

```
TypeLearn/
├─ macos/                  # SwiftUI 外壳（菜单栏视图 stub）
│  └─ ContentView.swift
├─ service/                # 本地编排服务（Node.js + TS）
│  └─ src/
│     ├─ index.ts
│     ├─ store.ts
│     ├─ coaching.ts
│     ├─ translator.ts
│     ├─ story.ts
│     └─ persistence.ts
├─ web/                    # React + Vite UI（inbox/choices/story）
├─ shared/                 # 共享 TypeScript 类型
├─ scripts/                # 开发辅助脚本
└─ PRODUCT.md              # 产品愿景
```

<br/>

## 快速开始

### 前置条件

| 需求 | 版本 |
|------|------|
| macOS | 12+ |
| Node.js | 18+ |

### 本地服务 + Web UI

```bash
npm install
npm run dev
```

- Service 默认监听 `http://127.0.0.1:43010`。
- Web UI 通过 Vite 启动（终端会打印访问地址）。

### Workspace 命令

```bash
npm run dev:service     # 仅启动 service
npm run dev:web         # 仅启动 web
npm run build           # 构建所有 workspaces
npm run typecheck       # 全量类型检查
```

<br/>

## macOS 应用状态

当前仓库包含 SwiftUI 外壳（`macos/ContentView.swift`），但 Xcode 工程尚未提交。`npm run dev:app` 目前只输出占位信息。

未来启用本地捕捉时，macOS 会要求 Accessibility 与 Input Monitoring 权限。

<br/>

## 架构

```
                         TypeLearn
    ┌────────────────────────┼────────────────────────┐
    │                        │                        │
    ▼                        ▼                        ▼
┌────────┐              ┌─────────┐              ┌────────┐
│ macOS  │   (planned)  │ Service │  ◄─ types ─► │ Shared │
└────────┘              └─────────┘              └────────┘
   SwiftUI               Node.js                TypeScript
                         :43010
                              ▲
                              │
                           ┌──────┐
                           │ Web  │
                           └──────┘
                        React + Vite
```

### 数据流（当前）

```
你输入 → POST /artifacts → 片段组装 → 学习条目
                                  │
                                  ├─ Choices（拼音/歧义澄清）
                                  ├─ Daily Lesson（模式总结）
                                  └─ Story 生成
```

<br/>

## 持久化与配置

- 本地状态文件：`~/.typelearn/state.json`
- 可用 `TYPELEARN_STATE_FILE` 覆盖路径
- Service 的 host/port：`HOST` 与 `PORT`

Provider 设置可通过 `PUT /settings` 更新：

```json
{
  "baseUrl": "http://localhost:11434",
  "apiKey": "sk-...",
  "model": "gpt-4.1-mini"
}
```

<br/>

## API 参考

Service 默认运行在 `http://127.0.0.1:43010`。

| 方法 | Endpoint | 说明 |
|:----:|----------|------|
| `GET` | `/health` | 健康检查 & provider 状态 |
| `GET` | `/artifacts` | 获取学习条目 |
| `POST` | `/artifacts` | 提交文本生成学习条目 |
| `POST` | `/artifacts/:id/retry` | 重试失败条目 |
| `GET` | `/records` | 获取捕捉记录 |
| `DELETE` | `/records/:id` | 删除捕捉记录 |
| `GET` | `/choices` | 获取 Choices 列表 |
| `POST` | `/choices/:id/select` | 选择候选表达 |
| `DELETE` | `/choices/:id` | 删除 Choices |
| `GET` | `/patterns?day=YYYY-MM-DD` | 某日模式统计 |
| `GET` | `/daily` | 每日 Lesson |
| `GET` | `/stories` | 获取故事列表 |
| `POST` | `/stories/generate` | 生成每日故事 |
| `GET` | `/settings` | 获取 Provider 设置 |
| `PUT` | `/settings` | 更新 Provider 设置 |

<br/>

## 隐私

TypeLearn 建立在严格的隐私模型之上 —— 你的输入只属于你。

```
┌─────────────────────────────────────────────────────────┐
│                    Your Mac (local)                     │
│                                                         │
│   Typing ──► Capture ──► Process ──► ~/.typelearn/      │
│                                                         │
│   No telemetry     No cloud sync     No tracking         │
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

- 所有数据默认本地存储。
- AI 功能可选，需显式配置 provider。
- 不会向 TypeLearn 开发者共享任何数据。

<br/>

## 技术栈

| 层 | 技术 | 作用 |
|----|------|------|
| Web UI | React 19, Vite | Inbox、Choices、Story、Settings |
| Service | TypeScript, Node.js | 编排、NLP、持久化 |
| macOS | Swift 6, SwiftUI | 菜单栏外壳（stub） |
| Shared | TypeScript | 共享领域类型 |
| 持久化 | JSON (local file) | `~/.typelearn/state.json` |
| 进程通信 | HTTP (localhost) | App ↔ Service 通信 |

<br/>

## License

All rights reserved.

<div align="center">
<sub>为隐私与语言学习体验用心打造。</sub>
</div>
