/**
 * Aerie: the shell's own kit (ADR 0015): the water, the band, Orbit and the
 * title cards, and the shell's notices. Only the shell imports it
 * (`pnpm check:boundaries`), so it can change with the shell and is not part of
 * the SDK promise. The shell loads `@augur/shell-kit/kit.css`.
 */
export * from '@augur/kit-common';
export { Toasts, type ToastItem, type ToastsProps } from './toast.js';
export { AppUnavailable, type AppState, type AppUnavailableProps } from './app-unavailable.js';
export { Connection, type ConnectionState, type ConnectionProps } from './connection.js';
