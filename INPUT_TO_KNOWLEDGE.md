# TypeLearn — Input → Knowledge Pipeline (Design Doc v1)

This document specifies a **stable, noise-resistant pipeline** that turns fragmented daily input (Chinese via pinyin guesses + English typing) into:

- **Clean utterances** (what the user actually meant to say)
- **Learning outputs** (English correction + better expressions)
- **Patterns** (repeatable grammar/expression lessons)
- **Daily lesson** (simple English teaching)
- **Abstract daily story** (contextual reinforcement + reusable lines)

It complements the high-level product direction in `PRODUCT.md`.

---

## 1) Goals

1) **Strict noise filtering**
- Prefer **dropping** ambiguous/noisy fragments. The user types a lot; quality > recall.

2) **Stable merging with context (streaming)**
- Input is often fragmented (pauses, IME, app switching). The pipeline must reconstruct “utterances” using a **sliding time window**, not fixed-size batches.

3) **Chinese/pinyin → learn usable English**
- If input is Chinese (or romanized/pinyin-ish), generate **reusable English expressions** (templates + alternatives), not literal translations.

4) **English → correction + 2 better rewrites**
- For English input, show:
  - **Corrected sentence**
  - **Alternative 1** (more natural/casual)
  - **Alternative 2** (clearer/more formal)

5) **Discover as many patterns as possible**
- Extract many micro “LearningEvents” per utterance.
- Aggregate into repeatable **Patterns** (daily summary + teaching).

6) **Teaching language: simple English**
- Explanations/lessons should be short, clear, and memorable (rule + analogy + examples + template).

7) **Story = abstract but intent-aligned**
- Story must not leak private details.
- Story should reflect the user’s intents/themes and include “stealable” lines.

---

## 2) Non-goals

- Perfect reconstruction of every input.
- Cross-app merging (default: never merge across apps).
- Capturing long documents as a single utterance.
- Showing confidence scores in the UI.

---

## 3) Key parameters (v1 defaults)

- **L = 20s** — commit delay / watermark
  - An utterance is only finalized (“committed”) after its end time is older than `now - L`.

- **W = 90s** — LLM observation window
  - When calling the LLM to merge/guess/filter, provide fragments from the last `W` seconds for that app stream.

- **Reversible tail**
  - Keep **last 3 utterances** in `draft` (reversible) state.
  - Keep **1 committed utterance** as *context-only* (not mergeable) for LLM coherence.

- **CHOICE TTL = 1 hour**
  - If the user does not choose a candidate within 1 hour, drop it.

- **LLM merge trigger** (suggested)
  - `idle >= 4s` for a given app stream, OR
  - tail gets too fragmented (e.g. > 8 fragments or > 4 draft utterances), OR
  - pinyin-like tail appears incomplete.

---

## 4) Glossary & Data Model

### 4.1 Fragment
A raw captured text chunk.

```ts
type Fragment = {
  id: string
  createdAt: string // ISO
  sourceApp: string | null
  captureSource: 'keyTap' | 'ax' | 'manual'
  text: string
  droppedReason?: 'hard_noise' | 'sensitive' // optional
}
```

### 4.2 Utterance
A reconstructed “unit of meaning” derived from one or more fragments.

```ts
type UtteranceStatus = 'draft' | 'committed' | 'needs_choice' | 'dropped'

type Utterance = {
  id: string
  sourceApp: string | null
  startAt: string
  endAt: string
  fragmentIds: string[]

  // merged raw text (may be pinyin-ish or English)
  raw: string

  languageHint: 'pinyin' | 'zh' | 'en' | 'mixed' | 'unknown'
  status: UtteranceStatus

  // only for needs_choice
  candidates?: Candidate[]
  expiresAt?: string
}

type Candidate = {
  // What the user likely meant (abstract)
  intentZh: string

  // Reusable English outputs (simple English)
  enMain: string
  enAlternatives?: string[]
  enTemplates?: string[]
}
```

### 4.3 Learning Output (per committed utterance)

```ts
type EnglishRewrite = {
  corrected: string
  alt1Natural: string
  alt2ClearFormal: string
}

type LearningEvent = {
  id: string
  utteranceId: string
  type: 'GrammarFix' | 'ExpressionUpgrade' | 'CN2EN'

  // keep these short; they power pattern extraction
  before: string
  after: string

  // simple English teaching (no confidence shown)
  teaching: {
    rule: string
    hook: string
    badExample: string
    goodExample: string
    template: string
  }

  // stable key for aggregation
  patternKey: string
  macroCategory: 'Tense' | 'Articles' | 'Prepositions' | 'WordChoice' | 'Collocation' | 'SentenceStructure' | 'Tone' | 'CN2EN'
}
```

### 4.4 Pattern
Aggregated repeated events.

```ts
type Pattern = {
  patternKey: string
  macroCategory: LearningEvent['macroCategory']

  title: string // short
  lesson: LearningEvent['teaching']

  counts: {
    today: number
    last7d: number
    total: number
  }

  exampleEventIds: string[] // 1–5 representative
}
```

---

## 5) Pipeline Overview (end-to-end)

### Step 0 — Capture produces fragments
- Capture may flush frequently (e.g. pauses) → fragments can be short and broken.
- Do **not** assume each fragment is meaningful.

### Step 1 — Ingest fragments + hard-noise drop
Hard drop without LLM (cheap + privacy-safe):
- URL / file paths / base64 / long random strings
- obvious code snippets
- repeated characters spam
- sensitive-like tokens (conservative)

Result:
- keep fragments that *might* be meaningful.

### Step 2 — Stream assembly (per-app) with sliding tail
Maintain a per-app `StreamState` (tail buffer).

**Watermark commit rule**:
- `watermark = now - L(20s)`
- only utterances with `endAt < watermark` can become `committed`

Keep last 3 utterances in `draft` to allow late merges.

### Step 3 — Merge + guess + filter with LLM (tail only)
When triggered, call `merge_and_filter()` with:
- `contextOnly`: last committed utterance text
- `tailFragments`: fragments within the last `W=90s`

LLM outputs utterances with actions:
- `DROP`: noise/too ambiguous
- `KEEP`: can commit (or remain draft until watermark)
- `CHOICE`: provide 3–5 candidates for the user to choose

### Step 4 — Choice handling (strict)
- For `CHOICE` utterances, create a UI card with candidates.
- If not chosen within **1 hour**, drop.
- If chosen, convert into a committed utterance (using the chosen candidate as the meaning anchor).

### Step 5 — Learning extraction
For each `committed` utterance:

**If Chinese/pinyin/mixed**
- Generate usable English expressions:
  - main expression
  - 2–4 alternatives
  - 2–3 templates
- Emit `LearningEvent(type='CN2EN')` (+ possibly ExpressionUpgrade).

**If English**
- Generate:
  - corrected
  - alt1Natural
  - alt2ClearFormal
- Emit many `LearningEvent`s (GrammarFix + ExpressionUpgrade).

### Step 6 — Pattern mining
- Aggregate `LearningEvent`s into `Pattern`s by `patternKey`.
- Count frequency (today/7d/total).
- Keep a few representative examples.

### Step 7 — Daily lesson (simple English)
- Output as many patterns as captured, grouped by macroCategory.
- Each pattern lesson has fixed structure:
  - Rule
  - Hook (analogy)
  - ❌ / ✅ examples
  - Template

### Step 8 — Abstract daily story
- Inputs:
  - user intents/themes (abstracted)
  - top patterns’ templates / target lines
- Output:
  - simple English story (no private details)
  - “Steal these lines” list

---

## 6) Sliding window merging details

### 6.1 Why time windows (not “last N fragments”)
Fixed-size batches can break merges at boundaries (fragment 30 + 31 problem).
A time-based tail plus watermark commit prevents this.

### 6.2 StreamState (per app)
```ts
type StreamState = {
  app: string | null
  tailFragments: Fragment[] // only last W seconds
  draftUtterances: Utterance[] // last few groups (reversible)
  lastCommittedUtteranceText?: string
  lastLLMRunAt?: string
}
```

### 6.3 Commit algorithm (watermark)
- Compute `watermark = now - 20s`.
- Any utterance ending before watermark becomes `committed`.
- Always keep **last 3 utterances** reversible (`draft`) even if they are near watermark.

### 6.4 When LLM is allowed to rewrite segmentation
Only inside tail (last 90s) and only for draft/needs_choice/dropped decisions.
Never rewrite older committed utterances.

---

## 7) LLM Contracts (JSON-only)

### 7.1 merge_and_filter
**Purpose**: turn fragments into grouped utterances; decide DROP/KEEP/CHOICE; for CHOICE produce candidates.

**Input**
```json
{
  "contextOnly": "<last committed utterance text, optional>",
  "fragments": [
    {"id": "f1", "t": "-12.4s", "text": "..."},
    {"id": "f2", "t": "-10.1s", "text": "..."}
  ],
  "rules": {
    "strictFilter": true,
    "choiceCandidates": 5,
    "storySafe": true
  }
}
```

**Output**
```json
{
  "utterances": [
    {
      "fragmentIds": ["f1","f2"],
      "action": "KEEP",
      "languageHint": "en",
      "mergedRaw": "..."
    },
    {
      "fragmentIds": ["f3"],
      "action": "CHOICE",
      "languageHint": "pinyin",
      "mergedRaw": "...",
      "candidates": [
        {
          "intentZh": "...",
          "enMain": "...",
          "enAlternatives": ["...","..."],
          "enTemplates": ["..."]
        }
      ]
    },
    {
      "fragmentIds": ["f9"],
      "action": "DROP",
      "reason": "hard_noise_or_too_ambiguous"
    }
  ]
}
```

### 7.2 extract_learning
**Purpose**: produce corrected + 2 alternatives; emit many LearningEvents with patternKey + simple teaching.

**Output shape (English input)**
```json
{
  "rewrite": {
    "corrected": "...",
    "alt1Natural": "...",
    "alt2ClearFormal": "..."
  },
  "events": [
    {
      "type": "GrammarFix",
      "macroCategory": "Prepositions",
      "patternKey": "preposition:on_weekend",
      "before": "in weekend",
      "after": "on the weekend",
      "teaching": {
        "rule": "Use 'on the weekend' for specific weekends.",
        "hook": "Think: days/weekends sit ON the calendar.",
        "badExample": "I work in weekend.",
        "goodExample": "I work on the weekend.",
        "template": "I usually ____ on the weekend."
      }
    }
  ]
}
```

### 7.3 generate_daily_artifacts
**Purpose**: generate daily lesson + abstract story using intents + pattern templates.

---

## 8) PatternKey design (fine-grained but aggregate-able)

### 8.1 Two-level grouping
- **macroCategory** groups patterns for readability.
- **patternKey** is fine-grained, stable, and re-usable.

### 8.2 Guidelines
- Prefer keys that generalize repeated mistakes (not per-sentence).
- Use canonical forms:
  - `articles:a_before_singular`
  - `tense:past_for_finished_action`
  - `preposition:on_the_weekend`
  - `collocation:make_a_decision`
  - `wordchoice:really_like_not_very_like`

---

## 9) UI/UX outputs (v1)

### 9.1 Per-utterance card (English input)
Show:
- Corrected
- Alternative 1 (Natural)
- Alternative 2 (Clear/Formal)
- List of micro patterns detected (expandable)

### 9.2 Choice cards
- Candidate list (3–5)
- Requires user selection
- Auto-drop after 1 hour

### 9.3 Daily lesson
- Group by macroCategory
- Show all patterns (collapse/expand per category)

### 9.4 Story
- Simple English abstract story
- “Steal these lines” list

---

## 10) Privacy & Safety

- Never bypass system permissions (Input Monitoring / Accessibility).
- Maintain sensitive app exclusions (bundle IDs) and allow user-configured exclusions.
- Minimize retention:
  - fragments are short-lived; committed utterances can be stored but should be user-deletable.
- When using providers:
  - send only what is necessary (tail window only)
  - avoid including private metadata; keep story abstract

---

## 11) Implementation notes (next steps)

This doc is intentionally implementation-agnostic. When implementing, prioritize:

1) Add `Fragment` + `Utterance` storage and the **Stream Assembler**.
2) Implement watermark commit with `L=20` and tail maintenance with `W=90`.
3) Add LLM `merge_and_filter` + CHOICE queue TTL.
4) Add `extract_learning` producing many micro `LearningEvent`s.
5) Add Pattern Miner + Daily lesson + Story generator.
