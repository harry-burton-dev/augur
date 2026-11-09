/** How far along what a page describes is: shipped and kept, shipped and still changing, or not built yet. */
export const STATUSES = ['stable', 'beta', 'planned'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = { stable: 'Stable', beta: 'Beta', planned: 'Planned' };

/** Starlight's badge variants, by status. */
export const STATUS_VARIANT: Record<Status, 'success' | 'caution' | 'note'> = {
  stable: 'success',
  beta: 'caution',
  planned: 'note',
};

/** What a reader is told under the title, by status. */
export const STATUS_NOTE: Record<Status, string | undefined> = {
  stable: undefined,
  beta: 'This is in beta: it works, and it may still change between releases.',
  planned: "This isn't built yet. The page says what is planned, and will change before it ships.",
};
