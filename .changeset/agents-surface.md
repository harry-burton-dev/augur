---
"@augur/mfe-sdk": minor
"@augur/ui-kit": minor
"@augur/shell": minor
"@augur/registry": minor
"@augur/admin": minor
"@augur/contract-tests": patch
---

Agents in the Shell. While an admin has models on, the Shell shows Agents: its own Assistant and each AI app's agent, each a conversation at `/agents/<id>` through the model gateway. An agent's tools are the intents apps describe in their manifest's new `intents` field (SDK 1.2), and the Shell asks the person (Allow, Not now) before raising any of them. AI apps can declare an `agent` of their own. The kit gains the AI Design group: `ui-conversation` and `ui-confirm-card`. Admin gains Agents and AI: the on/off switch, calls a day per app, and today's use. The registry keeps `/agents` and the id `assistant` for the shell and checks `agent` and `intents`.
