---
"@augur/registry": patch
---

Live on the workbench loads apps only from machines on the workbench's own tailnet, taken from `PLATFORM_URL`, not from any `*.ts.net` address: every Tailscale user's machines are under `*.ts.net`. The front door's Content Security Policy allows `https://*.<tailnet>.ts.net` alone, and a workbench whose `PLATFORM_URL` isn't on Tailscale loads from no machine and says why in Previews.
