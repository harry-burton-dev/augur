import type { QuillRemoteElementName, QuillRemoteEvents, QuillRemoteProperties } from '@augur/app-kit/remote';
import type { RemoteElement, RemoteNode } from '@augur/mfe-sdk/sdk3';

/**
 * What the app draws: Quill's remote elements by name, with their props (`@augur/app-kit/remote` types
 * them; nothing of the kit is bundled, since the app runs in a worker). The shell draws them with the
 * real kit and drops anything else. A prop `on<Event>` hears that event: `onPress` on a `quill-button`.
 * `slot` puts an element in its parent's slot, such as a dialog's fields.
 */
type Handlers<N extends QuillRemoteElementName> = {
  [E in keyof QuillRemoteEvents[N] & string as `on${Capitalize<E>}`]?: (detail: QuillRemoteEvents[N][E]) => void;
};
export const quill = <N extends QuillRemoteElementName>(type: N, props: QuillRemoteProperties[N] & Handlers<N> & { slot?: string }, children?: RemoteNode): RemoteElement => ({
  type,
  props,
  ...(children === undefined ? {} : { children }),
});
