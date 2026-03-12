# CaptureLearn Plan (High-Level)

## Goal
Build a macOS-first capture layer that monitors screen context and text signals, then feeds TypeLearn for learning and insights.

## Milestones
1. **MVP: Event-driven capture**
   - Window/app switch events
   - Clipboard and input events
   - Lightweight metadata capture (app name, window title, timestamps)

2. **Screen capture + local OCR (opt-in)**
   - Low-frequency sampling with strict rate limits
   - Local OCR only; upload text/summary, not images
   - Dedup + noise filtering to reduce storage/processing

3. **Privacy & storage controls**
   - Local-first storage by default
   - Optional cloud sync with explicit user toggle
   - Redaction rules for sensitive apps/domains

4. **Learning pipeline integration**
   - Feed normalized text into TypeLearn
   - Provide capture source context in learning cards

5. **Expansion**
   - Investigate iOS feasibility (keyboard extension only)
   - Cross-device sync and unified timeline
