/**
 * `FrameRoot.render(node)`: draws a `RemoteNode` description into a remote root in the worker's DOM,
 * which remote-dom then sends to the host as mutations. Each render is compared with what is there
 * by position, so an element that stays keeps its identity (a field keeps what was typed) and only
 * what changed crosses the bridge. An app may also build the tree with `document.createElement`
 * itself; this is the short way.
 *
 * Props become the element's properties; a function prop named `on<Event>` listens to that event and
 * gets its detail (`onOpen` hears `open`); `slot` puts the element in its parent's slot.
 */
import type { RemoteElement, RemoteNode } from './context.js';

type Described = RemoteElement | string;

/** What each element was last given, so a prop left out is cleared and a listener is swapped, not stacked. */
const given = new WeakMap<Element, { props: Record<string, unknown>; handlers: Map<string, (detail: unknown) => unknown>; listening: Set<string> }>();

/** The children a description holds, flattened: nested arrays open up, and nothing (null, false) is left out. */
function flatten(node: RemoteNode, out: Described[] = []): Described[] {
  if (node === null || node === undefined || (node as unknown) === false || (node as unknown) === true) return out;
  if (Array.isArray(node)) {
    for (const child of node) flatten(child, out);
    return out;
  }
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (typeof node === 'object' && typeof node.type === 'string') out.push(node);
  return out;
}

/** `onOpen` → `open`; `onRowAction` → `rowAction`. */
const eventOf = (prop: string) => (/^on[A-Z]/.test(prop) ? prop[2]!.toLowerCase() + prop.slice(3) : undefined);

/** Sets a property the way the element takes it: through its own setter when it declares one, else straight to the host, which drops it with a reason. */
function setProperty(el: Element, name: string, value: unknown) {
  const ctor = el.constructor as { remotePropertyDefinitions?: Map<string, unknown> };
  if (ctor.remotePropertyDefinitions?.has(name)) (el as unknown as Record<string, unknown>)[name] = value;
  else (el as unknown as { updateRemoteProperty?(n: string, v: unknown): void }).updateRemoteProperty?.(name, value);
}

/** A property's value as the element holds it, for one it declares; else the value last given. */
function current(el: Element, name: string, last: Record<string, unknown>) {
  const ctor = el.constructor as { remotePropertyDefinitions?: Map<string, unknown> };
  return ctor.remotePropertyDefinitions?.has(name) ? (el as unknown as Record<string, unknown>)[name] : last[name];
}

function update(el: Element, desc: RemoteElement) {
  let was = given.get(el);
  if (!was) given.set(el, (was = { props: {}, handlers: new Map(), listening: new Set() }));
  const props = desc.props ?? {};
  const seen = new Set<string>();
  for (const [name, value] of Object.entries(props)) {
    if (name === 'key' || name === 'children') continue;
    if (name === 'slot') {
      if (typeof value === 'string') el.setAttribute('slot', value);
      else el.removeAttribute('slot');
      seen.add(name);
      continue;
    }
    const event = typeof value === 'function' ? eventOf(name) : undefined;
    if (event) {
      was.handlers.set(event, value as (detail: unknown) => unknown);
      if (!was.listening.has(event)) {
        was.listening.add(event);
        const handlers = was.handlers;
        // One listener per event, calling whichever handler the latest render gave.
        el.addEventListener(event, (e) => void handlers.get(event)?.((e as CustomEvent).detail));
      }
      seen.add(name);
      continue;
    }
    seen.add(name);
    // Against what the element holds now, not what was last given: a field the person typed into
    // holds their words, so an app that sets it back to '' after a save still clears it.
    if (current(el, name, was.props) !== value) setProperty(el, name, value);
  }
  for (const name of Object.keys(was.props)) {
    if (seen.has(name)) continue;
    if (name === 'slot') el.removeAttribute('slot');
    else {
      const event = eventOf(name);
      if (event && was.handlers.has(event)) was.handlers.delete(event);
      else setProperty(el, name, undefined);
    }
  }
  was.props = Object.fromEntries([...seen].map((name) => [name, props[name]]));
  reconcile(el, desc.children);
}

function create(doc: Document, desc: Described): Node {
  if (typeof desc === 'string') return doc.createTextNode(desc);
  const el = doc.createElement(desc.type);
  update(el, desc);
  return el;
}

const matches = (node: ChildNode, desc: Described) =>
  typeof desc === 'string' ? node.nodeType === 3 : node.nodeType === 1 && (node as Element).localName === desc.type.toLowerCase();

/** Makes `parent`'s children what `node` describes, keeping each one that is still the same kind at its place. */
export function reconcile(parent: Element, node: RemoteNode) {
  const doc = parent.ownerDocument;
  const want = flatten(node);
  for (let i = 0; i < want.length; i++) {
    const desc = want[i]!;
    const at = parent.childNodes[i];
    if (at && matches(at, desc)) {
      if (typeof desc === 'string') {
        if ((at as Text).data !== desc) (at as Text).data = desc;
      } else update(at as Element, desc);
      continue;
    }
    const made = create(doc, desc);
    if (at) parent.replaceChild(made, at);
    else parent.appendChild(made);
  }
  while (parent.childNodes.length > want.length) parent.lastChild!.remove();
}
