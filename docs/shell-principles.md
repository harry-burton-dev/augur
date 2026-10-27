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
| **Fixed depth** | Getting around always goes app, area, group, page. Title shows apps and their areas. Orbit shows an app's groups and pages. The app shows the page. No level shows another level's things, so Title never lists an app's sub-menus or actions. | Shell menu builder and its tests (areas arrive with SDK 1.5) |
| **Nothing repeats its parent** | No child has the same label or icon as the thing it sits under, at any depth. | Registry check on every manifest; shell test over every built-in app (SDK 1.5) |
| **One child is the parent** | A level with one child isn't offered as a choice. An app with one area, or a group with one page, opens that thing itself. | Shell menu builder and its tests (SDK 1.5) |
| **Back is up one level** | Back and Esc work out the level above from the screen: an app goes to its Orbit, Orbit goes to Title. They are never wired up per app. | `upFrom()` and `backFrom()` in `platform/frontends/shell/src/host/menus.ts`, and their tests |
| **The bar is chrome, not a surface** | The top bar never paints a background on any screen. It stays readable over the water through one `scrim` token. The floor you're on sits top left with Back beside it, and the app's name sits under the look-up handle. | `ui-shell` styles and tests |
| **Every input moves both ways** | In both menus, the arrow keys, the wheel, a trackpad and a press-and-drag all move up and down through items and sideways through categories. Movement follows the hand, then settles on the nearest item. A notched mouse wheel moves one item per notch. A drag locks to one axis after 6px, and a press that moves less than that is still a click. | `ui-centre-menu` and its tests |
| **Reachable means readable** | Any menu icon that is shown and can be clicked keeps at least 55% opacity, so it keeps 3:1 contrast over the water. Things further away fade out completely rather than sitting faint. | `ui-centre-menu` test over both variants |
| **Menus are lists, not applications** | A menu's categories are a tablist and the focused category's items a listbox that holds focus and points at the focused item, so screen readers announce where you are without a special mode. | `ui-centre-menu` tests |
| **The choice carries you** | Every move between levels or floors is one motion: what you chose goes from where it was to where it lands, in the direction of the move. Menus and floors share it. | Kit motion helper and its direction tests (coming) |
| **Arrivals are generated** | The area title card shown on arriving at a floor or opening an app is built from that floor's or app's own data: its kind or level, name, and who sees it. No card is written by hand. An app's card fades out where it is. | `ui-shell` and its tests (coming) |
| **One motion switch** | The system's reduce-motion setting and AUGUR's own are one check. Every motion has a crossfade fallback, and loops stop. | Kit `motionMode()` and its tests (coming) |
| **Tokens only** | Every duration, distance and colour comes from `platform/packages/ui-kit/tokens/tokens.json`. Icons come from Lucide through `icon.ts`. | Token build; review |

Rules marked "coming" are agreed and being built. Until they land, the
behaviour they describe isn't there yet.
