import { openAiCompatible, standIn, type ModelProvider } from './provider.ts';

/**
 * The model, from the server's settings:
 *   MODEL_API_URL   an OpenAI-style API: https://openrouter.ai/api/v1, a LiteLLM
 *                   proxy (http://litellm:4000/v1), or "stand-in" for the
 *                   built-in model that doesn't think, for trying things out
 *   MODEL_API_KEY   its key, when it needs one
 *   MODEL_NAME      the model to ask, as that API names it
 *   MODEL_EMBEDDING_NAME  the model that turns text into vectors, for matching
 *                   by meaning, when the API has one (the stand-in always does)
 * Undefined without MODEL_API_URL: then there is no model.
 */
export const providerFromEnv = (env = process.env): ModelProvider | undefined => {
  const url = env.MODEL_API_URL?.trim();
  if (!url) return undefined;
  if (url === 'stand-in') return standIn();
  if (!/^https?:\/\//.test(url)) throw new Error(`MODEL_API_URL must be an http(s) address or "stand-in", not "${url}".`);
  const model = env.MODEL_NAME?.trim();
  if (!model) throw new Error('MODEL_NAME is not set: say which model to ask, as the API at MODEL_API_URL names it.');
  const embeddingModel = env.MODEL_EMBEDDING_NAME?.trim() || undefined;
  return openAiCompatible({ baseUrl: url, apiKey: env.MODEL_API_KEY?.trim() || undefined, model, embeddingModel, timeoutMs: Number(env.MODEL_TIMEOUT_SECONDS ?? 60) * 1000 });
};
