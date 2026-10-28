import { ENTITY_EXPLAIN, ENTITY_OPEN, ENTITY_PICK, defineMicroFrontend, isEntityRef, pickDocument, type EntityPick, type EntityRef, type Intent, type MountContext } from '@augur/mfe-sdk';
import { html, render } from 'lit';
import '@augur/ui-kit';
import { AtlasApi, pathFor, placeFor, type Place } from './api.js';
import './atlas-app.js';
import './atlas-picker.js';

/**
 * Where Data Atlas is in the address bar, so a place in it can be shared, and
 * Back goes to the last one: the shell mounts it again with that path.
 */
export const addressFor = (pathname: string, mountedAt: string, place: Place) => {
  const inner = mountedAt === '/' ? '' : mountedAt;
  if (!pathname.endsWith(inner)) return undefined;
  return `${pathname.slice(0, pathname.length - inner.length)}${pathFor(place)}`;
};

/** Where an intent asks Data Atlas to start: `entity.open` at the entity, `entity.explain` at it with why it shows marked. */
export const placeForIntent = (intent: Intent | undefined): Place | undefined => {
  if ((intent?.type !== ENTITY_OPEN && intent?.type !== ENTITY_EXPLAIN) || !isEntityRef(intent.payload)) return undefined;
  return { page: 'entity', id: intent.payload.id, ...(intent.type === ENTITY_EXPLAIN ? { explain: true } : {}) };
};

/** Data Atlas: the things the organisation knows about. What the shell mounts at /atlas. */
export default defineMicroFrontend({
  mount(el: HTMLElement, ctx: MountContext) {
    // Another app asked for entities: Data Atlas opens over it as a picker, and answers with what's chosen.
    if (ctx.intent?.type === ENTITY_PICK && ctx.reply) {
      const reply = ctx.reply;
      const pick = (ctx.intent.payload ?? {}) as EntityPick;
      const multiple = pick.multiple === true;
      render(
        html`<atlas-picker
          .api=${new AtlasApi((path, init) => ctx.fetch(path, init))}
          purpose=${typeof pick.purpose === 'string' ? pick.purpose : ''}
          .types=${Array.isArray(pick.types) ? pick.types.filter((t) => typeof t === 'string') : []}
          ?multiple=${multiple}
          floor-name=${ctx.workspace.name}
          @atlas-picked=${(e: CustomEvent<{ entities: EntityRef[] }>) => reply.respond(multiple ? e.detail.entities : e.detail.entities[0])}
          @atlas-cancel=${() => reply.cancel()}
        ></atlas-picker>`,
        el,
      );
      return;
    }
    let mountedAt = ctx.path;
    const moved = (e: CustomEvent<Place>) => {
      const to = addressFor(window.location.pathname, mountedAt, e.detail);
      if (!to || to === window.location.pathname) return;
      window.history.pushState(window.history.state, '', to);
      mountedAt = pathFor(e.detail);
    };
    render(
      html`<atlas-app
        .api=${new AtlasApi((path, init) => ctx.fetch(path, init))}
        floor-name=${ctx.workspace.name}
        floor-kind=${ctx.workspace.kind}
        .place=${placeForIntent(ctx.intent) ?? placeFor(ctx.path)}
        .pickDocument=${() => pickDocument(ctx, { purpose: 'Where it was read' })}
        @atlas-place=${moved}
      ></atlas-app>`,
      el,
    );
  },
  unmount(el: HTMLElement) {
    render(html``, el);
  },
});
