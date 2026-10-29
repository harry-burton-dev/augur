---
'@augur/ui-kit': minor
'@augur/shell': minor
---

Back in the top bar is gone. Beside the floor, two round buttons go to **Home** and to **All apps** (Title) from any screen, inside an app or not, and the one you're on is marked. On a floor without Home, Home stays and says why. New `ui-shell` property `navs` (`ShellNav[]`) and event `ui-nav`; `backTo` and `ui-back` still work for a host that sets them, but the shell no longer does. This also fixes the way out of an app opened from Title or Orbit doing nothing, because the shell still thought the move in was under way. Esc goes up one level as before.
