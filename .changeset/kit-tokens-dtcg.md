---
"@augur/ui-kit": patch
"@augur/shell": patch
---

Tokens now live in three W3C design token files (`tokens/common.tokens.json`, `shell.tokens.json`, `app.tokens.json`) and are built with Style Dictionary. Every CSS variable and token value is unchanged. The typefaces are now served by AUGUR through Fontsource instead of loading from Google Fonts at runtime, so a deployment without internet access still shows them.
