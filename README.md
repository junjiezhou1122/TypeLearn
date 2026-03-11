<div align="center">

# TypeLearn

### Learn English from every keystroke.

A privacy-first macOS menu bar app that transforms your daily typing into continuous, ambient language learning.

[![macOS](https://img.shields.io/badge/macOS-12%2B-000000?style=flat&logo=apple&logoColor=white)](#)
[![Swift](https://img.shields.io/badge/Swift-6-F05138?style=flat&logo=swift&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat&logo=typescript&logoColor=white)](#)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat&logo=node.js&logoColor=white)](#)
[![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-888?style=flat)](#)

<br/>

**TypeLearn quietly observes what you type, identifies learning moments, and helps improve your vocabulary, phrasing, and expression — without ever interrupting your flow.**

<br/>

[Getting Started](#-getting-started) · [Architecture](#-architecture) · [API Reference](#-api-reference) · [Privacy](#-privacy)

</div>

<br/>

## Why TypeLearn?

Most language-learning tools demand dedicated study time. TypeLearn takes a different approach: it meets you where you already are — at the keyboard.

> **Type naturally. Learn continuously. Stay in flow.**

<br/>

## Features

| | Feature | Description |
|---|---------|-------------|
| **⌨️** | **Ambient Learning** | Learns from your real typing — no flashcards, no separate study sessions |
| **📍** | **Menu Bar Native** | Lives in your macOS menu bar, always one click away |
| **🔒** | **Privacy-First** | All data stays local by default — nothing leaves your device without explicit consent |
| **🌐** | **Multilingual Capture** | Detects Chinese input and translates to English for cross-language learning |
| **✏️** | **Grammar Coaching** | Spots common mistakes and suggests improvements with clear explanations |
| **📖** | **Daily Stories** | Generates a personalized narrative from your day's writing to reinforce learning |
| **🔑** | **Bring Your Own Key** | Connect any OpenAI-compatible API for enhanced AI-powered features |

<br/>

## Getting Started

### Prerequisites

| Requirement | Version |
|-------------|---------|
| macOS | 12+ |
| Node.js | 18+ |
| Xcode | Latest |

The app will prompt for **Accessibility** and **Input Monitoring** permissions on first launch.

### Quick Start

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

Then open `macos/TypeLearn.xcodeproj` in Xcode and hit **Run** to launch the menu bar app.

<br/>

## Architecture

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
<summary><b>How it works</b></summary>

<br/>

```
 You type → CaptureMonitor detects input → Buffer flushes on pause
                                                    │
                                                    ▼
                                          POST /artifacts
                                                    │
                                                    ▼
                                     ┌──────────────────────────┐
                                     │   Orchestration Service   │
                                     │                          │
                                     │  1. Detect language      │
                                     │  2. Translate if needed  │
                                     │  3. Apply coaching rules │
                                     │  4. Generate artifact    │
                                     │  5. Persist to disk      │
                                     └──────────────────────────┘
                                                    │
                                                    ▼
                                          Learning artifact
                                         surfaces in your UI
```

</details>

### Monorepo Structure

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

## Development

```bash
npm run build           # Build all workspaces
npm run dev:service     # Start service in dev mode
npm run typecheck       # Type-check everything
npm run test            # Run test suite
```

<details>
<summary><b>Workspace-specific commands</b></summary>

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

## API Reference

The orchestration service runs at `http://127.0.0.1:43010`.

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

## Privacy

TypeLearn is built on a strict privacy model — your keystrokes are yours.

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

| Mode | Description | Remote Calls |
|------|-------------|:------------:|
| **Local** *(default)* | All processing on-device | None |
| **BYOK Remote** | Bring your own API key | Your provider only |
| **Custom Endpoint** | Point to any OpenAI-compatible API | Your endpoint only |

- All data persists locally at `~/.typelearn/state.json`
- AI features (translation, story generation) are **opt-in** and require explicit provider configuration
- No data is ever shared with TypeLearn developers

<br/>

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| **Frontend** | Swift 6, SwiftUI | Menu bar app, keyboard capture, UI |
| **Backend** | TypeScript, Node.js | Orchestration, NLP, persistence |
| **Build** | npm workspaces, tsc | Monorepo management |
| **Persistence** | JSON (local file) | `~/.typelearn/state.json` |
| **IPC** | HTTP (localhost) | App ↔ Service communication |

<br/>

## Roadmap

- [x] macOS menu bar shell with permission management
- [x] Privacy-conscious keyboard capture (CGEvent + Accessibility)
- [x] Learning artifact generation with grammar coaching
- [x] Local persistence and review UI
- [x] Provider abstraction (local / BYOK / custom)
- [x] Chinese → English translation pipeline
- [x] Daily story generation
- [ ] Enhanced noise filtering and capture quality
- [ ] Richer coaching with contextual suggestions
- [ ] Spaced repetition for learned artifacts
- [ ] Export and backup functionality

<br/>

## License

All rights reserved.

<div align="center">
<sub>Built with care for privacy and the craft of language.</sub>
</div>
