# 0058. Quill's Editor is built on Tiptap, and keeps writing the same small Markdown

- **Status:** Proposed
- **Date:** 2026-11-04
- **Decided by:** Harry
- **Replaces:** none. Reopens the Lit kit's default "own textarea editor, not Tiptap" (app kit plan, K5, 29 October 2026) for the React kit only. Builds on [0015](0015-react-kits-tailwind.md) and [0054](0054-app-frontend-starter-libraries.md).

## Context

Quill's `Editor` (augur-kit, `packages/app-kit/src/editor.tsx`) is a textarea. It writes a small Markdown subset (paragraphs, bold, italic, bullet lists, quotes, line breaks) and mentions as links: `[@Nora Briggs](person:u1)`, `[#HMS Example](entity:ent_1)`. Because a textarea holds only plain characters, a mention can't show where it is written: the text reads "@Nora Briggs", the chip sits under the box, the caret can land inside the name, and editing one letter silently drops the link. Bold and italic show as asterisks while writing.

The alpha (goal 18, PER-147) needs the writing kit apps will use for intents, back-briefs, concerns and discussion. The library report (3 November, M5) recommends Tiptap. Any rich-text editor is a new dependency, so it needs a record (AGENTS.md).

## Options

1. **Tiptap 3** (MIT, on ProseMirror). Headless, so every pixel is drawn with the kit's tokens. First-party React bindings and a Mention extension with several triggers (`@` and `#`). Markdown shortcuts (`- `, `1. `, `> `, Ctrl B, Ctrl I) built in. About 12 million weekly downloads; 3.x stable since July 2025. Yjs co-editing is a later option, not built.
2. **Lexical** (MIT, Meta). Smaller, but still 0.x with a moving API, and the mention node is ours to build.
3. **ProseMirror directly.** The same engine as option 1, but the React bindings, mentions and input rules are ours to write and keep.
4. **Keep the textarea.** No dependency, but mentions stay awkward, which is the gap this unit closes.

## Decision

Option 1, with these rules:

- **Only these packages**, pinned exactly in `@augur/app-kit` and updated by Renovate: `@tiptap/core`, `@tiptap/react`, `@tiptap/pm`, `@tiptap/extension-document`, `-paragraph`, `-text`, `-bold`, `-italic`, `-list`, `-blockquote`, `-hard-break`, `-mention`, `@tiptap/extensions` (placeholder, undo and redo) and `@tiptap/suggestion`, plus `prosemirror-markdown` (stable, MIT, on the `markdown-it` the kit already uses) to read and write the Markdown. Never `@tiptap-pro/*` or Tiptap Cloud.
- **The stored format doesn't change.** The editor reads and writes the same Markdown subset and the same `[@Name](kind:id)` mention links as today, plus numbered lists (`1. `). Anything else in a value (headings, web links, HTML) is kept as plain text. No app's stored data moves.
- **Same props.** `Editor`, `Prose`, `readMentions`, `writeMentions` and `plainText` keep their names and props in Quill's main entry. Apps never import Tiptap; it is behind `Editor`, so the engine can change without touching an app.
- **Loaded only where people write.** `Editor` loads the engine with a dynamic `import()`, so the kit bundle puts ProseMirror and Tiptap in a chunk of their own and a page that never shows an editor never loads it. No new import map entry and no SDK change. `Prose` stays light: it reads with `markdown-it` and draws React elements, never HTML.
- **ARIA by hand, in one place.** React Aria has no rich-text editor, so the editable area carries `role="textbox"`, `aria-multiline`, its label and description, and the mention list is a `listbox` tied to it with `aria-controls` and `aria-activedescendant`. Everything else stays React Aria.

## Consequences

- A mention is one unit in the text: it shows as a chip where it was written, the caret steps over it, and one Backspace removes it whole.
- Formatting shows as formatting while writing. Pasted rich text is cut down to the subset.
- The editor chunk is about 130 kB gzipped (markdown-it, which Quill already loads for its reader, comes on top of it), loaded once per kit version and only by pages with an editor. The main Quill module doesn't grow.
- Behaviour that happy-dom can't fake (typing into contenteditable) is covered by Storybook stories in a real browser on Chromatic; the Markdown round trip and the mention format are unit tests.
- Harry's K5 default stays true for the frozen Lit kit's `ui-editor` until SDK 2 removes it.

## Links

- Linear: PER-147 (alpha W3.4, goal 18).
- AUGUR alpha implementation plan, block 3.4.
- Library and patterns report, M5 (Drive).
