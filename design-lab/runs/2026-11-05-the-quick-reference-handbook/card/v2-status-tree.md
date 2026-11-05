# AUGUR after an upgrade: four things that must hold

*Symptom-based card. Don't work out why it broke. Check four things, top to bottom; the first one that fails tells you what to do. Check all four again after anything you do. True for AUGUR 0.18.x.*

**Use this card when** any notice or Needs you item is about an upgrade that went back, didn't install, or kept running after its watch saw a problem.

**Done when** all four hold, or you've made them safe until morning and written it down.

> **BEFORE YOU READ ON:** touch nothing. AUGUR may already have gone back by itself. Note the backup file the notice or History names: `____________________`

---

## The four checks

| # | Must hold | Check (`READ`, changes nothing) | Holds when | Fails → |
|---|---|---|---|---|
| 1 | **Sign-in works** | Open AUGUR in a browser and sign in | The shell loads and you're signed in | **Table 1** |
| 2 | **Every part answers** | `pc ps`, then `pc exec -T updater node dist/index.js check` | All `healthy`; `"ok":true` | **Table 2** |
| 3 | **Data fits the code** | `pc logs --since 15m <each part not healthy>` | No error about tables, schema or data being newer or missing | **Table 3** |
| 4 | **The way back exists** | `ls infra/deploy/backups` and `cat infra/deploy/backups/restore-test.json` | The file you noted is there, and the test of it says `"ok":true` | **Table 4** |

All four hold → write the hand-off (below) and stop.

---

## Table 1. Sign-in doesn't work
| You see | Do | Don't |
|---|---|---|
| The address doesn't answer | `pc logs tailscale`; docs/deploy.md, "If something's wrong" | Restart the stack: it hides what you'd read |
| The page loads, sign-in fails | `pc ps keycloak identity`; `pc logs --since 15m keycloak identity` | Go back to a release before 0.18.0: Keycloak 26.8's database can't go back (docs/upgrade.md) |
| Anything else | Stop. Hand off with what you saw | |

## Table 2. A part doesn't answer
| You see | Do | Don't |
|---|---|---|
| One part `Restarting` or `unhealthy`, the rest `healthy` | Go to check 3 for that part | Restart it: if it fails on its data, it fails again |
| Several parts down | `pc logs --since 15m <each>`, then check 3 | Try the upgrade again |
| `check` says sign-in fails | Table 1 | |

## Table 3. Data doesn't fit the code
The code went back, and the data stayed as the new release left it (docs/upgrade.md, Going back, step 2). Only a restore fixes that. **A restore loses everything saved since the backup, for every app, and more each hour people work.**

| You see | Do |
|---|---|
| Admin → Activity since the backup shows little or nothing by people, and you can give it 20 minutes | Pause point, then restore (below) |
| Much saved since, or you're not sure | `ACT` turn that app off for the organisation (Admin → Apps). Hand off: "needs a restore of *file*, loses everything since *time*" |

> **PAUSE POINT, then `ONE-WAY` restore.** Say out loud: the file by name; what it loses; that the night is written down (notice, History steps, Activity), because the restore rewinds AUGUR's own record of it.
>
> Stop everything but Postgres (docs/deploy.md's words; its command lists only some parts, so this card stops all, then starts Postgres alone):
> ```sh
> pc stop
> pc up -d postgres
> gunzip -c infra/deploy/backups/<the file> | pc exec -T postgres psql -U platform -d postgres
> pc up -d
> ```
> Then all four checks again. **Notices after a restore describe AUGUR's rewound records, not the server. Trust the checks, not the notices.**

## Table 4. No way back
| You see | Do | Don't |
|---|---|---|
| The file isn't there, or its test failed | Don't restore anything tonight. Turn the failing app off. Hand off | Restore an older file by its date: it loses every day between |
| Backups taken after the failure are newer | Use the file you noted, by name | Restore "the newest" |

---

**NEVER, AT ANY CHECK:** `pc down -v` (deletes every database) · go back past 0.18.0 · try the same upgrade again · `git checkout` over `infra/deploy`.

**HAND-OFF.** The four checks as you last saw them, with pasted output; what you did and when; what's lost; what's still unknown. Tell Harry if the release is at fault (only he can halt it: Actions → Halt rollout).
