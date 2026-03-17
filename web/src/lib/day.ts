import type { LearningArtifact } from '../types';

export type DayGroup = {
  day: string;
  label: string;
  items: LearningArtifact[];
};

export type DayOption = {
  day: string;
  label: string;
  count: number;
};

export const formatDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDayKey = (dayKey: string): Date => {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const formatDateControlLabel = (dayKey: string): string => (
  parseDayKey(dayKey).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
);

export const getDayLabel = (dayKey: string): string => {
  const todayKey = formatDayKey(new Date());
  const yesterdayKey = formatDayKey(new Date(Date.now() - 86_400_000));

  if (dayKey === todayKey) return 'Today';
  if (dayKey === yesterdayKey) return 'Yesterday';

  return new Date(`${dayKey}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const humanizePatternKey = (patternKey: string): string => {
  const parts = patternKey.split(':');
  const raw = parts.length > 1 ? parts[1] : parts[0];
  return raw.replace(/[_-]+/g, ' ').trim();
};

export const groupByDay = (artifacts: LearningArtifact[]): DayGroup[] => {
  const grouped = new Map<string, LearningArtifact[]>();

  artifacts.forEach((artifact) => {
    const dayKey = formatDayKey(new Date(artifact.createdAt));
    const bucket = grouped.get(dayKey);

    if (bucket) {
      bucket.push(artifact);
      return;
    }

    grouped.set(dayKey, [artifact]);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, items]) => ({
      day,
      label: getDayLabel(day),
      items,
    }));
};
