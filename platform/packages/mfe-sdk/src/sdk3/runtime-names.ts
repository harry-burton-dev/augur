/**
 * What both ends of the bridge name the same way, kept apart from the runtime: the runtime puts
 * remote-dom's DOM in the worker's global scope, which the shell's page must never load.
 */
import type { Person, Workspace } from './context.js';
import type { Intent } from '../contract.js';

/** What the host sends with `start`. */
export interface StartInit {
  /** The app's entry module, a path on the shell's own origin. */
  entry: string;
  person: Person;
  workspace: Workspace;
  path: string;
  previewsOn: string[];
  intent?: Intent;
  /** The app was opened to answer a request. */
  replying?: boolean;
}

/** The roots an app renders into: the screen, its Home card, and one per declared About section. */
export const SCREEN_ROOT = 'screen';
export const CARD_ROOT = 'card';
export const aboutRoot = (id: string) => `about:${id}`;
