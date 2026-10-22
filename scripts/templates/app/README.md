# __NAME__

| Path | What it is |
| --- | --- |
| `manifest.json` | How the registry lists the app: its route, entry, the SDK range it works with |
| `frontend/` | The micro frontend the shell mounts at `/__ID__` (`@apps/__ID__-frontend`) |
| `service/` | The app's own API, reached through the gateway at `/api/__ID__` (`@apps/__ID__`) |

Run it in a stand-in shell with `pnpm dev:app __ID__`. See [Build an app](../../docs/build-an-app.md).
