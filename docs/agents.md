# Agents and models

AUGUR has one way to reach an AI model: the **model gateway** (`platform/services/models`). It is the only place a provider's key is kept. Apps' services and the shell's Agents ask the gateway, and the gateway asks the model, so no app or browser ever holds an AI key or knows which provider is behind it.

The gateway:

- records every call in the audit log (`model.called`: who, for which app, which model, how many messages, which tools; never what was said) **before** making it, and makes no call it can't record;
- gives each app a number of calls a day (UTC), 500 unless an admin changes it; the shell's own assistant counts as one app, `assistant`;
- is **off** until an admin turns it on in Admin, and can't be turned on until the server has a model.

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

The gateway also needs its own sign-in, `MODELS_CLIENT_SECRET` (`openssl rand -hex 32`), to check apps' grants and write the audit log. Then `pc up -d`, and turn models on in Admin.

Optionally set `MODEL_EMBEDDING_NAME` too, for matching by meaning (below), and `MODEL_TIMEOUT_SECONDS` for how long the gateway waits for an answer (60 seconds unless set).

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

## Matching by meaning

An app's service can also turn texts into vectors with `embedTexts` from `@augur/service-kit`, to find things that mean the same though they're worded differently. Data Atlas uses it in Triage. It needs an embedding model on the server: set `MODEL_EMBEDDING_NAME` beside `MODEL_API_URL` (for example `openai/text-embedding-3-small` on OpenRouter, or whatever your LiteLLM proxy or Ollama serves). The stand-in always has one, which puts texts spelt alike close together but knows nothing of meaning.

```ts
import { embedTexts } from '@augur/service-kit';

const { vectors, model } = await embedTexts({ modelsUrl: process.env.MODELS_URL!, credentials, workspace, input: ['Northern Tern', 'MV Arctic Dawn'] });
```

The same rules apply as for `askModel`: `models:use`, one call for each request (up to 64 texts), recorded as `model.embedded` without the texts. Keep `model` beside the vectors you store: vectors from different models don't compare. Without an embedding model the gateway answers 503, saying so.

The gateway's API is in [contracts/models.openapi.yaml](../contracts/models.openapi.yaml).
