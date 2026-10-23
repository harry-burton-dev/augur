# Agents and models

AUGUR has one way to reach an AI model: the **model gateway** (`platform/services/models`). It is the only place a provider's key is kept. Apps' services and the shell's Agents ask the gateway, and the gateway asks the model, so no app or browser ever holds an AI key or knows which provider is behind it.

The gateway:

- records every call in the audit log (`model.called`: who, for which app, which model, how many messages, which tools; never what was said) **before** making it, and makes no call it can't record;
- gives each app a number of calls a day (UTC), 500 unless an admin changes it; the shell's own assistant counts as one app, `assistant`;
- is **off** until an admin turns it on in Admin, and can't be turned on until the server has a model.

## Agents in the Shell

Once models are on, the Shell has **Agents** beside Apps and Find. It lists:

- **Assistant**, the Shell's own agent, always there;
- each AI app (`"ai": true`) with an `agent` in its manifest, which the Shell talks to on the app's behalf;
- AI apps without one, which open as apps.

Choosing an agent opens its conversation at `/agents/<id>` on the floor you're on. The Shell holds the conversation (one per agent per floor, until the page is reloaded) and asks the model through the gateway, as the agent: its calls count against that app's limit, or `assistant`'s.

An agent's **tools are apps' intents**. Every intent an app you can open here describes in its manifest's `intents` is offered to the model; one it doesn't describe never is. When the model asks to use one, the Shell shows a card ("Open “Q3 report” in Library?") with **Allow** and **Not now**, and nothing happens until you choose. Allow raises the intent through the Shell exactly as an app's `ctx.raise` would, so the app opens with it; Not now tells the agent it wasn't done. One thing at a time: anything else the model asks for in the same turn is turned down.

Turning models off in Admin takes Agents out of the Shell the next time it loads.

## Turning it on

Admin, **Agents and AI** (under Platform): the switch, the calls each app gets a day, which model the server has, and what each app used today. The switch can't be turned on until the server has a model. Every change is in Activity.

## Setting up the model

The gateway speaks the OpenAI-style chat completions API (`POST <url>/chat/completions`), which most providers and proxies answer. Set three things in `infra/deploy/.env`:

| Setting | What it is |
| --- | --- |
| `MODEL_API_URL` | The API's base address, without `/chat/completions` |
| `MODEL_API_KEY` | Its key, if it needs one |
| `MODEL_NAME` | The model to ask, as that API names it |

Some choices:

- **OpenRouter**, one key for many providers' models: `MODEL_API_URL=https://openrouter.ai/api/v1`, `MODEL_NAME=openai/gpt-4o-mini` (or any model id from openrouter.ai/models).
- **LiteLLM**, a proxy you run that routes to whichever providers you configure, with its own keys and budgets: `MODEL_API_URL=http://litellm:4000/v1` (as the compose network reaches it), `MODEL_NAME` one of its model names. This is the way to use the org's own Azure OpenAI or Bedrock deployment later.
- **Any OpenAI-compatible server**, including local ones (Ollama at `http://<host>:11434/v1`, vLLM).
- **The stand-in**: `MODEL_API_URL=stand-in` needs no key and doesn't think. It answers with what you said, and offers a tool when your words match its description, so the whole path (Agents, a confirmation card, an intent) can be tried on a server with no provider. The local dev stack uses it.

The gateway also needs its own sign-in, `MODELS_CLIENT_SECRET` (`openssl rand -hex 32`), to check apps' grants and write the audit log. Then `pc up -d --build`, and turn models on in Admin.

Admin's Status shows the gateway like every service. When a call fails, the person sees why in words (for example "The model provider answered 401: check MODEL_API_KEY"), and the gateway's log has the rest.

## An app's service asking the model

An app's service asks as itself with `askModel` from `@augur/service-kit`. It needs `models:use` in its manifest's `scopes`, which an admin allows in Admin, Apps like any other scope:

```ts
import { askModel } from '@augur/service-kit';

const answer = await askModel({
  modelsUrl: process.env.MODELS_URL!, // http://models:8085 inside the compose network
  credentials,                        // the app's own sign-in, as for notify
  workspace,                          // the floor it's for: the grant is checked there
  messages: [
    { role: 'system', content: 'Summarise documents in two sentences.' },
    { role: 'user', content: text },
  ],
});
console.log(answer.message.content, answer.usage);
```

Pass `tools` (a name, a description and a JSON schema for the arguments) and the answer may carry `toolCalls` instead of text: the app does what was asked, then sends the result back as a `tool` message with the call's `toolCallId`. The gateway never does anything itself.

`askModel` throws a `ServiceCallError` whose message says why when models are off (403), the app isn't granted `models:use` on that floor (403), it has used its calls for today (429), or the provider failed (502, 504).

## Giving agents an app's intents, or an agent of its own

In the app's manifest (see [Build an app](build-an-app.md#agents)):

```json
{
  "handles": ["document.open"],
  "intents": [
    {
      "type": "document.open",
      "description": "Open a document by its title",
      "payload": { "type": "object", "properties": { "title": { "type": "string" } }, "required": ["title"] },
      "confirm": "Open “{title}”"
    }
  ],
  "ai": true,
  "agent": { "instructions": "You find documents and summarise them.", "greeting": "What are you looking for?" },
  "scopes": ["models:use"]
}
```

- `intents` describes intents from `handles` for agents: `description` is what the model chooses by, `payload` a JSON schema it fills in, and `confirm` what the person is asked, with `{field}` from the payload. The Shell adds "in <app>?".
- `agent` gives an AI app its own agent in the Shell. It needs `"ai": true` and the `models:use` scope, granted on the floor.

The intent arrives in the app's `ctx.intent` as from any other app, so it must check the payload like any input: it was written by a model.

The gateway's API is in [contracts/models.openapi.yaml](../contracts/models.openapi.yaml).
