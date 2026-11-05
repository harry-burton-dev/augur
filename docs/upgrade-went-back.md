# When an upgrade goes back by itself

A card for the admin who wakes to an upgrade that went back, didn't install, or kept running after its watch saw a problem, often at night. It fits on two printed pages: print it and keep it beside the server, because it's needed most when AUGUR doesn't load, and a restore rewinds AUGUR's own record of the night. It is also linked from the notice and from Needs you.

**Don't work out why it broke.** Check four things, top to bottom: the first one that fails tells you what to do. Check all four again after anything you do. **Done when** all four hold, or you've made things safe until morning and written down what you saw and did.

*Written for AUGUR 0.18. Tested 5 Nov 2026 against a scripted night: three walk-throughs, not a live tabletop (design-lab run `2026-11-05-the-quick-reference-handbook`). A pull request that changes the updater, the backups or the restore changes this card too.*

> **BEFORE YOU READ ON: touch nothing.** AUGUR may already have gone back by itself. Don't restart, retry the upgrade or take a backup "to be safe": a new backup becomes the newest, and the newest is no longer the way back. Write down the backup file the notice or Upgrade Centre → History names: `platform-______________Z.sql.gz`. Its time is UTC.

**On the server**, over SSH, in the folder you deployed from (the one with `infra/deploy` in it):

```sh
cd <your checkout>
alias pc='docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env'
```

`pc` commands stop and start AUGUR's own containers, Tailscale's node among them. They don't touch your SSH to the host, as long as you reach the host some other way than through AUGUR's node. Check that now, before you need it.

## The four checks

| # | Must hold | Check (`READ`: changes nothing) | Holds when | Fails → |
|---|---|---|---|---|
| 1 | **Sign-in works** | Open AUGUR in a browser and sign in | The shell loads and you're signed in | Table 1 |
| 2 | **Every part answers** | `pc ps`, then `pc exec -T updater node dist/index.js check` | All `healthy`, and `"ok":true` | Table 2 |
| 3 | **Data fits the code** | `pc logs --since 1h <each part not healthy>` | No error about tables, schema or data being newer than it knows, or missing | Table 3 |
| 4 | **The way back exists** | `ls infra/deploy/backups`, then `cat infra/deploy/backups/restore-test.json` | The file you wrote down is there, and the test's `"file"` is **that file** with `"ok":true` | Table 4 |

All four hold → write the hand-off (below) and stop.

## Table 1. Sign-in doesn't work

| You see | Do | Don't |
|---|---|---|
| The address doesn't answer | `pc logs tailscale`; then [deploy.md, If something's wrong](deploy.md#if-somethings-wrong) | Restart the stack: it hides what you'd read |
| The page loads, sign-in fails | `pc ps keycloak identity`; `pc logs --since 1h keycloak identity` | Go back to a release before 0.18.0: Keycloak 26.8's database can't go back ([upgrade.md](upgrade.md#keycloak-268-and-the-realm-job)) |
| Anything else | Stop. Hand off with what you saw | |

## Table 2. A part doesn't answer

| You see | Do | Don't |
|---|---|---|
| One part `restarting` or `unhealthy`, the rest `healthy` | Check 3 for that part | Restart it: if it fails on its data, it fails again |
| Several parts down | `pc logs --since 1h <each>`, then check 3 | Try the upgrade again |
| `check` says sign-in fails | Table 1 | |
| `check` won't run (the updater itself is down) | `pc logs --since 1h updater`; treat it as several parts down | |

## Table 3. Data doesn't fit the code

The code went back, and the data stayed as the new release left it ([upgrade.md, Going back](upgrade.md#going-back), step 2). Only a restore fixes that. **A restore loses everything saved since the backup, in every app and in sign-in, and more each hour people work.** First do check 4: restore only a file that's there and tested.

| You see | Do |
|---|---|
| Admin → Activity since the backup's time shows nothing, or only a little, done by people, and you can stay up another 20 minutes | Check 4, then the pause point, then the restore (below) |
| Much saved since, you're not sure, or check 4 fails | `ACT` (can be undone): turn that app off for the organisation in Admin → Apps, so people see it's off rather than broken. Hand off: "needs a restore of *file*, which loses everything since *time*, more each hour" |

> **PAUSE POINT, then the `ONE-WAY` restore.** Say out loud: the file, by name; what it loses (from Activity); that the night is written down **outside AUGUR**: the notice's words, the upgrade's steps in History, Activity since the backup. The restore rewinds AUGUR's own record of all of it. Any doubt: stop here, contain as above, and hand off.
>
> Stop **everything** but Postgres. Wait for Postgres to say `healthy`, then load the file and start everything again:
> ```sh
> pc stop
> pc up -d postgres
> pc ps postgres            # again until it says healthy
> gunzip -c infra/deploy/backups/<the file> | pc exec -T postgres psql -U platform -d postgres
> pc up -d
> ```
> The dump drops and recreates each database itself. Then all four checks again. **A notice after a restore describes AUGUR's rewound records, not the server: an upgrade you restored past can say again that it didn't install. Trust the checks, not the notices.**

**Restored, and a check still fails:** stop. Don't restore again, and don't try another file. Turn the failing app off and hand off with every check's output.

## Table 4. No way back

| You see | Do | Don't |
|---|---|---|
| The file isn't there, its test failed, or the test is of another file | Don't restore anything tonight. Turn the failing app off. Hand off | Restore an older file by its date: it loses every day between |
| Backups taken after the failure are newer | Use the file you wrote down, by name | Restore "the newest" |

---

**NEVER, AT ANY CHECK:** `pc down -v` (it deletes every database) · go back past 0.18.0 · try the same upgrade again · take a backup before deciding · `git checkout` or `git pull` over `infra/deploy` (the updater may have written it).

**HAND-OFF**, to the next admin and to whoever publishes your releases: the four checks as you last saw them, with pasted output; what you did, and when (UTC); what a restore lost, or would lose; what's still unknown. If the release is at fault, say so: only its publisher can stop it reaching other servers (Actions → Halt rollout, [release-channels.md](release-channels.md)). Leave the item in Needs you unless nothing is left to do.

## What this card can't do yet

Each of these would make the card shorter. Until they exist, the card does them by hand.

- A restore the updater runs, which stops the right parts, checks the load and writes the night's record first.
- Saying whether the data went back too, and how much a restore would lose.
- Watching the go-back: "went back by itself" doesn't yet mean every part answers on the old release.
- A notice that reaches an admin who isn't signed in (email alerts wait on ADR 0059).
