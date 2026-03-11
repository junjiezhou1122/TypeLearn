# TypeLearn Product Doc

## Product Summary

TypeLearn is a privacy-first macOS menu bar app that turns daily English typing into lightweight, continuous learning. It observes what the user types locally, identifies useful learning moments, and helps the user improve vocabulary, phrasing, and expression without interrupting normal computer use.

## Goals and Principles

- Make English learning happen inside normal daily work instead of requiring separate study sessions.
- Stay low-friction, ambient, and fast enough to fit naturally into a menu bar utility.
- Preserve user trust through strict privacy boundaries and clear control over captured data.
- Focus on practical writing improvement rather than test prep or academic coursework.
- Ship an MVP that proves daily typing can become a reliable learning loop.

## Target User

The primary user is a macOS user who types in English regularly and wants to improve through real-world usage. This includes international professionals, students, founders, and knowledge workers who already spend much of the day writing messages, notes, documents, and prompts in English.

## Product Promise and Privacy Boundaries

### Product Promise

TypeLearn helps users learn better English from the writing they already do every day, with minimal interruption and a strong sense of personal control.

### Privacy Boundaries

- Privacy-first is a product requirement, not an optional feature.
- The app should minimize collection and retention of raw typed content.
- Sensitive content handling must be conservative by default.
- Users should understand what is captured, what is processed, and what can leave the device.
- Any cloud/provider usage must be explicit, limited, and consistent with the app's privacy promise.

## Core Experience

1. The user runs TypeLearn as a macOS menu bar app.
2. The app observes daily typing activity in a privacy-conscious way.
3. TypeLearn detects moments that are useful for English learning, such as awkward phrasing, repeated mistakes, or opportunities to express something more naturally.
4. The app turns those moments into lightweight learning artifacts such as corrections, rewrites, explanations, and review items.
5. The user can review insights, revisit patterns, and build improvement over time without leaving the core product loop.

The experience should feel ambient, helpful, and non-judgmental rather than intrusive.

## Provider Strategy

- The product should support a provider abstraction rather than locking into one model vendor.
- Different providers may be used for analysis, rewriting, explanation, or future personalization tasks.
- Provider choice should remain compatible with the privacy-first promise.
- Local-first and privacy-preserving options should be favored where quality is sufficient.
- The architecture should allow swapping or extending providers without changing the user-facing product model.

## Technical Direction (High Level)

- A macOS menu bar app delivers the user-facing experience.
- A local service coordinates capture, processing, learning generation, and persistence.
- Privacy controls and data boundaries are enforced close to capture and processing flows.
- Learning artifacts are stored in a way that supports review, iteration, and future ranking/personalization.
- Provider integrations sit behind stable interfaces so the product can evolve without major architectural churn.

## MVP Scope

The MVP should prove the core value proposition with a narrow, trustworthy feature set:

- macOS menu bar app shell
- local typing-aware capture flow
- privacy controls and clear user boundaries
- generation of English-learning insights from daily writing
- lightweight review surface for generated learnings
- basic persistence of learning artifacts and history
- provider abstraction with at least one working path

The MVP is not meant to solve every language-learning use case. It should validate that daily typing can become a repeatable English improvement loop.

## Milestone Plan

### Milestone 1: Foundation

- establish product boundaries and privacy model
- create macOS menu bar shell
- stand up local orchestration/service structure

### Milestone 2: Capture and Learning Loop

- connect privacy-conscious typing capture
- transform captured writing moments into learning artifacts
- store and surface the initial review experience

### Milestone 3: Provider and Quality Layer

- formalize provider abstraction
- improve rewrite/explanation quality
- tune trust, relevance, and noise reduction

### Milestone 4: MVP Hardening

- refine end-to-end UX
- validate privacy boundaries and reliability
- prepare the product for repeated real-world usage

## Validation Strategy

- Validate that users understand the privacy model and trust the product.
- Measure whether generated learning moments feel relevant and useful.
- Check that the capture-to-learning flow works reliably during normal daily typing.
- Ensure the review loop helps users notice improvement over time.
- Evaluate provider quality, latency, and privacy tradeoffs continuously.
- Use milestone-based testing across app UX, local service behavior, persistence, and privacy controls.

## Current Execution Status and Next Step

### Current Status

The product direction is defined at a high level: TypeLearn is positioned as a privacy-first macOS menu bar app that turns daily typing into English learning, with provider flexibility and a local-first architecture.

### Next Step

Translate this product definition into execution by building the foundational app shell, local orchestration layer, and privacy-aware capture path for the MVP.
