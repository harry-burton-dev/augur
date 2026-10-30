---
"@augur/shell": patch
"@augur/ui-kit": patch
---

Jost and Nunito are served with the shell (Fontsource) instead of from Google Fonts, so AUGUR looks right on a server with no internet access and its pages no longer call Google. The front door's Content Security Policy drops fonts.googleapis.com and fonts.gstatic.com.
