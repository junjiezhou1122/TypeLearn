import type { LearningEvent, MacroCategory, Pattern, Teaching } from '../../shared/src/index';

export function addEventsToPatterns(state: {
  events: LearningEvent[];
  patterns: Record<string, Pattern>;
}, newEvents: LearningEvent[]): void {
  for (const ev of newEvents) {
    state.events.unshift(ev);

    const key = ev.patternKey;
    const existing = state.patterns[key];

    if (!existing) {
      state.patterns[key] = {
        patternKey: ev.patternKey,
        macroCategory: ev.macroCategory,
        title: deriveTitle(ev),
        lesson: ev.teaching,
        counts: { today: 0, last7d: 0, total: 0 },
        exampleEventIds: [ev.id],
      };
    } else {
      // Keep the original lesson unless missing.
      state.patterns[key] = {
        ...existing,
        macroCategory: existing.macroCategory ?? ev.macroCategory,
        lesson: existing.lesson ?? ev.teaching,
        exampleEventIds: mergeExampleIds(existing.exampleEventIds, ev.id),
      };
    }
  }

  // Recompute counts from events (simple, safe).
  recomputePatternCounts(state);
}

export function recomputePatternCounts(state: {
  events: LearningEvent[];
  patterns: Record<string, Pattern>;
}): void {
  const today = isoDay(new Date().toISOString());
  const last7Cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const counters = new Map<string, { today: number; last7d: number; total: number }>();

  for (const ev of state.events) {
    const key = ev.patternKey;
    const createdAtMs = Date.parse(ev.createdAt);

    const curr = counters.get(key) ?? { today: 0, last7d: 0, total: 0 };
    curr.total += 1;
    if (isoDay(ev.createdAt) === today) curr.today += 1;
    if (Number.isFinite(createdAtMs) && createdAtMs >= last7Cutoff) curr.last7d += 1;
    counters.set(key, curr);
  }

  for (const [key, pattern] of Object.entries(state.patterns)) {
    const c = counters.get(key) ?? { today: 0, last7d: 0, total: 0 };
    state.patterns[key] = {
      ...pattern,
      counts: c,
    };
  }
}

export function getPatternsForDay(patterns: Record<string, Pattern>, _events: LearningEvent[], day: string): Pattern[] {
  // Counts already track today/last7d/total; for now we just return all patterns sorted by today's count,
  // and the endpoint allows specifying day only to support future per-day slicing.
  // If day != today, we still return patterns but sorted by total (stable, simple).
  const isToday = day === isoDay(new Date().toISOString());

  return Object.values(patterns).sort((a, b) => {
    const aScore = isToday ? a.counts.today : a.counts.total;
    const bScore = isToday ? b.counts.today : b.counts.total;
    return bScore - aScore;
  });
}

export function groupPatterns(patterns: Pattern[]): Array<{ macroCategory: MacroCategory; patterns: Pattern[] }> {
  const order: MacroCategory[] = [
    'CN2EN',
    'WordChoice',
    'Collocation',
    'Prepositions',
    'Articles',
    'Tense',
    'SentenceStructure',
    'Tone',
  ];

  const map = new Map<MacroCategory, Pattern[]>();
  for (const p of patterns) {
    const list = map.get(p.macroCategory) ?? [];
    list.push(p);
    map.set(p.macroCategory, list);
  }

  const groups: Array<{ macroCategory: MacroCategory; patterns: Pattern[] }> = [];
  for (const cat of order) {
    const list = map.get(cat);
    if (list && list.length) {
      groups.push({ macroCategory: cat, patterns: list });
    }
  }

  // Any categories not in order.
  for (const [cat, list] of map.entries()) {
    if (!order.includes(cat)) {
      groups.push({ macroCategory: cat, patterns: list });
    }
  }

  return groups;
}

export function buildStealLines(patterns: Pattern[], limit = 12): string[] {
  const lines: string[] = [];
  for (const p of patterns) {
    const t = p.lesson?.template;
    if (t && typeof t === 'string' && t.trim()) {
      lines.push(t.trim());
      if (lines.length >= limit) break;
    }
  }
  return unique(lines);
}

function deriveTitle(ev: LearningEvent): string {
  // Keep it short and stable-ish.
  const key = ev.patternKey;
  if (key.includes(':')) {
    const [, rest] = key.split(':', 2);
    if (rest) return rest.replace(/[_-]+/g, ' ').trim();
  }
  return key.replace(/[_-]+/g, ' ').trim();
}

function mergeExampleIds(existing: string[], nextId: string): string[] {
  const out = existing.includes(nextId) ? existing : [nextId, ...existing];
  return out.slice(0, 5);
}

function isoDay(iso: string): string {
  return iso.slice(0, 10);
}

function unique(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}
