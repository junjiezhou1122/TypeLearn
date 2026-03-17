export type ViewType = 'inbox' | 'story' | 'digest' | 'choices' | 'lesson' | 'settings';
export type FilterType = 'all' | 'english' | 'chinese';

export type DigestFocus =
  | { type: 'pattern'; id: string }
  | { type: 'moment'; id: string }
  | { type: 'session'; id: string };

export const VIEW_DETAILS: Record<ViewType, { title: string; subtitle: string }> = {
  inbox: {
    title: 'Inbox',
    subtitle: 'Your daily writing, turned into small teachable moments.',
  },
  choices: {
    title: 'Review',
    subtitle: 'Resolve ambiguous inputs only when they are worth your attention.',
  },
  lesson: {
    title: 'Lesson',
    subtitle: 'Patterns extracted from the day, organized into a teachable summary.',
  },
  story: {
    title: 'Story',
    subtitle: 'A narrative recap of the day, distilled from what you typed.',
  },
  digest: {
    title: 'Digest',
    subtitle: 'Compression, sessions, moments, and reusable lines for each day.',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Provider controls for the local-first language studio.',
  },
};
