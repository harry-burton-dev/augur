---
"@augur/mfe-sdk": minor
"@augur/shell": minor
"@augur/ui-kit": patch
---

The React kits begin (ADR 0015). Three new packages: Common (`@augur/kit-common`), which now holds the token files and builds a Tailwind v4 theme from them with nothing of Tailwind's own palette or scales; Quill (`@augur/app-kit`), the kit apps build with; and Aerie (`@augur/shell-kit`), the shell's own kit. The shell now serves React 19, Common and Quill through the import map (`sharedModules` in the SDK), and uses that copy of React itself. Aerie is never shared, and `pnpm check:boundaries` fails if anything but the shell imports it. The Lit kit is frozen through SDK 1.x and reads its tokens from Common; nothing looks different.
