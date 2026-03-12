# TypeLearn Web Experience Redesign

## Purpose

This document redefines the role of the TypeLearn web interface.

The macOS app should be treated as the capture layer:

- it runs quietly in the background
- it captures real user input
- it sends that input into the local learning pipeline

The web interface should be treated as the meaning layer:

- it explains why captured input matters
- it turns raw input into useful learning assets
- it gives the user a place to reflect, review, and improve

In short:

**macOS captures input. Web turns input into value.**

## Product Positioning

TypeLearn Web should not feel like:

- a debug console
- a SaaS analytics dashboard
- an AI playground
- a plain history viewer

It should feel like:

- a personal English reflection space
- a language mirror
- a low-pressure learning desk
- a place where everyday writing becomes reusable knowledge

Core message:

**Your everyday input is not noise. It is evidence of what you want to say, how you currently say it, and what you are ready to learn next.**

## Core Product Promise

TypeLearn helps the user learn from language they were already going to produce anyway.

This means the web experience must reinforce three ideas:

1. The input has value because it comes from real life.
2. The value is unlocked by transformation, not by storage.
3. The learning is ambient because it does not require a separate study workflow.

## Key UX Principle

Do not design the web interface as an input viewer.

Design it as an input transformation system.

Raw input is only the source material. The real product begins when the system converts that material into:

- an insight
- a reusable phrase
- a pattern
- a review card
- a story
- a collection of expressions for a real scenario

## Two Different Learning Paths

Chinese input and English input should not share the same artifact design.

They represent different user needs and should lead to different learning experiences.

### Path A: English Input

English input means the user already attempted expression in English.

The learning goal is:

- improve correctness
- improve naturalness
- improve tone
- improve clarity

This path answers:

**How can I say what I already wrote more accurately and more naturally?**

### Path B: Chinese Input

Chinese input means the user had an intention, but did not express it in English.

The learning goal is:

- express the idea in English
- learn useful phrasing for future reuse
- connect daily situations with English patterns

This path answers:

**If I want to say this in English next time, how can I say it?**

## Artifact Strategy

The system should transform input into different artifact types depending on the source language and learning value.

### 1. Refinement Artifact

Used for English input.

Purpose:

- help the user improve real English they already wrote

Recommended structure:

- `You wrote`
- `A more natural way`
- `Why this works better`
- `Category`

Recommended categories:

- `Fix`
- `Better`
- `Style`

Meaning:

- `Fix`: there is a clear mistake or strong correction
- `Better`: the original is understandable, but the alternative is more natural
- `Style`: the change is mainly about tone, polish, or precision

Example:

- You wrote: `I very like this idea`
- A more natural way: `I really like this idea`
- Why this works better: `In natural English, "really like" sounds smoother than "very like".`
- Category: `Better`

### 2. Expression Artifact

Used for Chinese input.

Purpose:

- help the user build English expression from real-life intent

Recommended structure:

- `What you wanted to say`
- `How to say it in English`
- `Other ways to say it`
- `When you'd use this`
- `Phrase to keep`

Example:

- What you wanted to say: `我今天有点忙，晚点回复你`
- How to say it in English: `I'm a bit tied up today, so I'll get back to you later.`
- Other ways to say it: `I'm a little busy right now, but I'll reply later.`
- When you'd use this: `Useful in chat, work messages, and email replies.`
- Phrase to keep: `get back to you later`

## Learning Asset Pyramid

Not every input should become a heavyweight learning item.

The system should transform inputs in stages.

### Layer 1: Input Evidence

This is the raw timeline of what the user typed.

Purpose:

- show continuity
- give transparency
- prove that insights are grounded in real usage

This is not yet the main learning layer.

### Layer 2: Insight

This is the first meaningful transformation.

Examples:

- one refined English sentence
- one useful English expression from Chinese intent

Purpose:

- deliver an immediate small learning moment

### Layer 3: Pattern

This is a grouped insight derived from multiple inputs.

Examples for English input:

- repeated grammar issue
- repeated literal phrasing
- repeated overuse of weak words

Examples for Chinese input:

- repeated need to ask for help
- repeated work update scenarios
- repeated scheduling and follow-up language

Purpose:

- show the user that their inputs reveal stable learning opportunities

### Layer 4: Reusable Asset

This is where the product becomes truly valuable.

Examples:

- a phrase card
- a scenario card
- a saved rewrite
- a short expression set for a common situation

Purpose:

- make the learning reusable in future real life

### Layer 5: Reflection

This is the narrative and emotional layer.

Examples:

- daily story
- weekly summary
- personal growth reflection

Purpose:

- help the user feel continuity
- help the user notice progress
- make learning feel personal rather than mechanical

## What Makes an Input Valuable

Not every captured input deserves the same weight.

An input becomes valuable if it does at least one of the following:

- represents a common real-life scenario
- contains a phrase worth reusing
- reveals a repeated weakness
- reveals a repeated intention
- can be grouped into a pattern
- can teach the user how to express something they are likely to say again

This implies a promotion model:

- low-value input stays in the timeline
- medium-value input becomes an insight
- high-value input becomes a saved asset or review card
- repeated related inputs become a pattern or story ingredient

## Story vs Flashcard

Story and flashcard should both exist, but they should not serve the same purpose.

### Story

Story is for:

- reflection
- emotional continuity
- making the day feel coherent
- showing that fragmented language can become meaningful

Story is especially powerful because it can combine:

- Chinese intent
- English attempts
- rewritten expressions
- daily communication themes

Story is not primarily a memorization tool.

It should answer:

**What did my language reveal about my day, my work, and my learning?**

### Flashcard

Flashcards are for:

- lightweight recall
- reusable expression memory
- practicing a small number of high-value items

Flashcards should not be generated for every input.

They should only be created for high-value items, such as:

- a Chinese intent that maps to a useful English phrase
- an English mistake that the user repeats
- a phrase that is broadly reusable in future communication

Flashcard types:

#### Expression Card

Best for Chinese input.

- Front: the original Chinese intent
- Back: the English phrasing, alternatives, and a key phrase

#### Refinement Card

Best for English input.

- Front: the original English sentence
- Back: the improved version and a short reason

## Scenario Collections

One of the most important learning formats should be scenario-based collections.

Why:

- single inputs are often too small and too isolated
- users learn faster when expressions are grouped by real use case
- real expression value comes from reuse, not one-off viewing

Examples:

- Delaying a reply
- Asking for help
- Giving a project update
- Explaining a problem
- Following up politely
- Disagreeing softly

A scenario collection may contain:

- several phrase cards
- alternative English formulations
- tone variants
- examples drawn from the user's own input history

This is where TypeLearn becomes more than an analyzer.

It becomes a personal expression library.

## Web Information Architecture

The current web app should move away from `Insights / Stories / Settings`.

Recommended primary navigation:

- `Today`
- `Library`
- `Patterns`
- `Review`
- `Story`
- `Settings`

### Today

Purpose:

- prove that today's inputs already created learning value

Recommended sections:

- `Today in your English`
- one English refinement spotlight
- one Chinese expression spotlight
- `Patterns taking shape`
- `Today's input timeline`
- story preview

Key message:

**Today's inputs already became something useful.**

### Library

Purpose:

- store reusable learning assets

Recommended content:

- saved phrases
- saved rewrites
- expression cards
- scenario collections
- favorite items

Key message:

**Your inputs are becoming a personal English library.**

### Patterns

Purpose:

- help the user understand recurring language habits

Recommended content:

- recurring issues
- recurring intentions
- expressions to upgrade
- things the user already does well
- suggested next focus

Key message:

**Your inputs are not random. They reveal stable patterns.**

### Review

Purpose:

- give the user a light, low-pressure review loop

Recommended content:

- a small number of flashcards
- repeated issue reminders
- useful phrases worth recalling

Key message:

**You do not need a heavy study system. You only need timely reminders from your own life.**

### Story

Purpose:

- provide reflection and emotional continuity

Recommended content:

- daily story
- weekly story
- highlighted phrases used in the story
- links back to source inputs and learning moments

Key message:

**Your fragmented language can still tell a coherent story.**

### Settings

Purpose:

- configure provider and privacy behavior

Recommended content:

- provider setup
- privacy explanation
- capture scope explanation
- retention preferences
- language preferences

Key message:

**This is where trust is configured, not where learning happens.**

## Home Page Logic

The homepage should follow a strict value narrative.

Recommended order:

1. Show that today's inputs were transformed.
2. Show the single most useful English refinement.
3. Show the single most useful Chinese-to-English expression.
4. Show the patterns behind those items.
5. Show the evidence timeline.
6. Show where those inputs are going next: library, review, and story.

This order matters.

If the user sees a list first, the product feels like a log viewer.

If the user sees transformation first, the product feels like a learning system.

## UX Writing Guidelines

The wording should focus on value, not capture mechanics.

Avoid language like:

- captured records
- input history
- analysis result
- synced content
- processed data

Prefer language like:

- learning moments
- worth keeping
- a more natural way to say it
- how to say this in English
- patterns in your writing
- useful expressions from today
- your language this week

The writing should make the user feel:

- understood
- guided
- not judged
- not overloaded

## Visual Direction

The web experience should avoid the look of a standard admin tool.

Recommended visual direction:

- editorial notebook
- language journal
- quiet writing desk

Desired qualities:

- light theme first
- text-forward hierarchy
- calm, warm neutrals
- restrained accent color
- strong typography
- fewer generic cards
- more rhythm, grouping, and annotation-like structure

The visual system should communicate:

This is not a control panel.

This is a place where your language is examined, organized, and returned to you in a more useful form.

## Success Criteria

The redesign should be considered successful if the user immediately understands:

1. Why their captured input matters.
2. Why Chinese and English inputs are treated differently.
3. How input turns into reusable learning material.
4. Why the product is ambient rather than effort-heavy.
5. What they can come back for tomorrow, next week, and over time.

## Summary

The web interface should be built around one core idea:

**Input becomes learning assets.**

That transformation should be different for English and Chinese:

- English input becomes refinement and pattern awareness.
- Chinese input becomes expression building and reusable phrases.

The most important outputs are not raw records.

The most important outputs are:

- insights
- patterns
- phrases
- cards
- collections
- stories

The job of the web product is to make those outputs feel useful, personal, and worth returning to.
