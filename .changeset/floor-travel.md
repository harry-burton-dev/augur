---
"@augur/ui-kit": minor
"@augur/shell": minor
"@augur/identity": minor
---

Moving between floors travels: what you're looking at leaves the way you're going (going up, it sinks away; going down, it rises away; across, it slides aside), the host waits for that before taking the app down, and the next floor comes in from the other side. Each arrival plays an area title card in place of the floor-name pill: the kind of floor, its name set large, and who sees what's there. Opening an app plays its card too, the app's name under the floor it opened on, once per app rather than on every page. Cards are built from the floor or app, never written by hand, leave off a kicker that would only repeat the name, ignore the pointer, end on any key, press or scroll, and fade out where they are. A new Area titles switch in Settings turns them off, saved with a person's preferences (`areaTitles` in Identity). `ui-shell` gains `leaveFloor()`; new tokens `travel-floor` (96px) and `motion-title` (2400ms); kit exports `floorKindName` and `FloorDirection`. Under reduced motion nothing travels and cards appear and fade in place.
