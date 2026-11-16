---
'@augur/shell': minor
'@augur/identity': minor
'@augur/contract-tests': patch
---

The shell keeps tokens in the page's memory only, never in the browser's storage, where any script on AUGUR's origin could read them (PER-453). A reload or a new tab gets a sign-in from the sign-in service in a hidden frame (`/auth/silent`), and one that has run out, or nearly, is renewed when a call needs it (no longer on a timer), with the refresh token or, when that is turned down, the same way, one renewal at a time. A sign-in an earlier release left in session storage is removed. The realm job turns on refresh token rotation (`revokeRefreshToken`, no reuse), so each refresh token works once. The front door now enforces the Content-Security-Policy on `/apps/`, `/assets/` and `/shared/` (`infra/deploy/not-a-page.conf`), which was report-only. The deploy test checks that no token is in the shell page's storage and that a reload and a second tab stay signed in, in Chromium, Firefox and WebKit.
