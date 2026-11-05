# Daylight · V4 · Upgrade while someone is awake

*The shortest 2am card is the one nobody needs at 2am. This sheet argues against the default window and sets up the people, not the server.*

## Move the window

AUGUR on production installs patch releases by itself on **Sunday at 02:00, for two hours** (docs/upgrade.md). At that hour:
- the watch is usually **too quiet to judge errors**: it needs 20 calls in 10 minutes, and the guide says a night window rarely has them. A light watch goes on into the morning, and a failure then doesn't go back by itself;
- the one person who could act is asleep;
- a restore costs little at 02:00, but nobody does it until 09:00, when it costs the morning.

**Instead:** a window on a working day, early, when you're up and a few people are signing in. Say Tuesday 07:30 for one hour, in the deployment's time zone (`DEPLOYMENT_TIME_ZONE`). The watch then has calls to judge, and you're there when it ends.

`ACT` Upgrade Centre → AUGUR → windows. It asks for password and code. Undo: change it back.

Or set AUGUR to **Ask first**, and start each upgrade yourself, at a time you choose. "An upgrade an admin asks for starts at once, whatever the window."

## Know how you'd hear

| Question | Today | Fill in |
|---|---|---|
| How does a failed upgrade reach you? | A notice in AUGUR's shell, to deployment admins and admins (docs/notifications.md). `NOT DOCUMENTED`: anything that reaches a phone that isn't looking at AUGUR. Email alerts are Proposed (ADR 0059) | |
| Is your phone on the tailnet? | needed to open AUGUR from it | |
| Can you reach the server without AUGUR? | SSH from the laptop you'd use | |

## Know who else

| Who | For what | How to reach them |
|---|---|---|
| A second deployment admin (Admin → People) | someone who can act when you can't | |
| Harry, the publisher | halting a bad release for every server (Actions → Halt rollout); a fixed release | |
| The people who use the failing app | telling them what was lost | |

## Agree the rule

Write it at the top of the 2am card, so the tired person doesn't have to decide it: "**If restoring loses nothing people saved, restore tonight. Otherwise contain it, and restore at ____ with ____.**"
