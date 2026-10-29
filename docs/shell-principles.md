# Shell principles

The rules the shell, the kit and the registry follow for getting around
AUGUR: the menus, the top bar, and moving between screens and floors. Each is
a rule, not a fix for one screen. The shell works out what to show from app
manifests and floors, and nothing in it names a particular app, so a rule
holds for apps and floors that don't exist yet.

Each rule says what holds it: a test, a registry check on manifests, or a
token. If you need to break one, change the rule here first.

| Rule | What it means | Held by |
| --- | --- | --- |
| **Nothing is obtuse** | AUGUR never hides something only because you can't use it right now. Anything disabled or unavailable stays where it would be, looks unavailable, and says why in plain words: who can use it, what it's waiting for, or what would turn it on. Hiding is only for things you are not allowed to know exist. This applies across the platform, not only the shell. | Kit controls carry a `reason` with their disabled state, shown on hover and focus; `pnpm check:reasons` in CI fails a platform screen that disables one without it, and the kit warns on localhost |
| **Fixed depth** | Getting around always goes app, area, group, page. Title shows apps and their areas. Orbit shows an app's groups and pages. The app shows the page. No level shows another level's things, so Title never lists an app's sub-menus or actions. | `titleMenu()` and `orbitMenu()` in `platform/frontends/shell/src/host/menus.ts`, and their tests |
| **Nothing repeats its parent** | No child has the same label or icon as the thing it sits under, at any depth. | `menuWarnings()` in the registry, run on every manifest it takes and by `pnpm check:manifest`; a registry test over the platform's own apps; a shell test over Title and Orbit |
| **One child is the parent** | A level with one child isn't offered as a choice. An app with one area, or a group with one page, opens that thing itself. | `areasOf()` and `orbitMenu()` in the shell, the centre menu's itemless category, and their tests |
| **Home and Title go there from anywhere** | Two round buttons top left, beside the floor, are the same on every screen: Home goes to Home, and All apps goes to Title, from Title, Orbit or inside any app. The one you're on is marked, and Home stays and says why when a floor hasn't got it. Esc still goes up one level, worked out from the screen (an app to its Orbit, Orbit to Title), and an app that keeps its own menu keeps Esc. None of this is wired up per app. | `navsFor()`, `navTarget()` and `backFrom()` in `platform/frontends/shell/src/host/menus.ts`, and their tests |
| **Every app stands on the same ground** | Title and Orbit sit on water. Every app sits on the one still slate ground, the one Artifacts is drawn on, whatever the app. Between screens the ground doesn't change, so moving floors inside an app never shows the water. | `waterFor()` in `platform/frontends/shell/src/App.tsx`, and the contract test "an app sits on the still ground" |
| **The bar is chrome, not a surface** | The top bar never paints a background on any screen. It stays readable over the water through one `scrim` token. The floor you're on sits top left with Home and All apps beside it, and the app's name sits under the look-up handle. | `ui-shell` styles and tests |
| **Every input moves both ways** | In both menus, the arrow keys, the wheel, a trackpad and a press-and-drag all move up and down through items and sideways through categories. Movement follows the hand, then settles on the nearest item. A notched mouse wheel moves one item per notch. A drag locks to one axis after 6px, and a press that moves less than that is still a click. | `ui-centre-menu` and its tests |
| **Reachable means readable** | Any menu icon that is shown and can be clicked keeps at least 55% opacity, so it keeps 3:1 contrast over the water. Things further away fade out completely rather than sitting faint. | `ui-centre-menu` test over both variants |
| **Menus are lists, not applications** | A menu's categories are a tablist and the focused category's items a listbox that holds focus and points at the focused item, so screen readers announce where you are without a special mode. | `ui-centre-menu` tests |
| **The choice carries you** | Every move between levels or floors is one motion: what you chose goes from where it was to where it lands, in the direction of the move. Menus and floors share it. | `liftGhost()` in `platform/packages/ui-kit/src/motion.ts` and the centre menu's `leave()`, with their tests. On a floor move the screen leaves the way you're going and the next comes in from the other side (`leaveFloor()` in `ui-shell`) |
| **A floor move that changes nothing isn't offered** | In an app that shows the same on every floor, the floor gauge rests. It stays in view, dimmed, and pointing at it says why, rather than moving you to a floor that looks the same. The app says so once in its manifest (`sameOnEveryFloor`), and no app is special-cased in the shell. | `ui-shell` `floorsRest` and its test; Admin's entry in `platform/services/registry/src/manifest.ts` |
| **Arrivals are generated** | The area title card shown on arriving at a floor or opening an app is built from that floor's or app's own data: its kind or level, name, and who sees it. No card is written by hand. An app's card fades out where it is. A card plays alone: what's behind it, the app or the floor's screen, stays unseen until the card has faded, then fades in. | `ui-shell` builds the card from the floor's kind, name and who sees it, or from the app and the floor it opened on, and its tests. A kicker that would only repeat the name is left off. It ignores the pointer, and any key, press or scroll ends it. The Area titles setting turns cards off |
| **One motion switch** | The system's reduce-motion setting and AUGUR's own are one check. Every motion has a crossfade fallback, and loops stop. | Kit `motionMode()` and its tests; the reduce block in the kit's `base.css` sets every motion token to near zero and stops loops. A key or press during a move jumps it to its end (`finishMotion()`) |
| **Tokens only** | Every duration, distance and colour comes from `platform/packages/ui-kit/tokens/tokens.json`. Icons come from Lucide through `icon.ts`. | Token build; review |

Rules marked "coming" are agreed and being built. Until they land, the
behaviour they describe isn't there yet.

Where the shell hides things today, it is to be measured against **Nothing is
obtuse**: an app offered only on some kinds of floor, a menu entry that needs
a role, and an empty menu should show as unavailable with the reason, unless
knowing it exists is itself restricted.
