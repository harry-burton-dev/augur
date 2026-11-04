---
"@augur/identity": patch
---

On a fresh server, Artifacts, Explorer and Data Atlas now start only after the realm job has made their sign-ins. Before, they could start too early. Then they failed to give the registry their frontends and register, and they never appeared in the shell until someone restarted them. The deploy test's new browser check found this.
