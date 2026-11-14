---
---

augurctl (`pnpm augurctl`) checks deployment files (`deployments/<name>.yaml`, `scripts/augurctl/deployment.schema.json`), makes a deployment's secrets file with sops, shows how a server differs from its file, lists each server's release, health, last backup, last upgrade and apps, and installs a new server from a release's deploy bundle, all over ssh.
