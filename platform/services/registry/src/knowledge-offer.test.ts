import { describe, expect, it } from 'vitest';
import { knowledgeOffer } from './knowledge-offer.ts';

const answering = (answers: Record<string, () => Response>) => {
  const asked: string[] = [];
  const fetchImpl = (async (url: string) => {
    asked.push(url);
    const path = new URL(url).pathname;
    return answers[path]?.() ?? new Response('', { status: 404 });
  }) as unknown as typeof fetch;
  return { fetchImpl, asked };
};

describe('what the knowledge graph offers apps, asked at install', () => {
  it('reads the actions of its catalogue and the classes its ontology has', async () => {
    const { fetchImpl, asked } = answering({
      '/v1/actions': () => Response.json({ apiMajor: 1, version: '1.6.0', actions: [{ name: 'retain' }, { name: 'hold' }] }),
      '/v1/meta': () => Response.json({ apiMajor: 1, ontology: { baseClasses: ['kg:Ship'], classes: ['kg:Ship', 'kg:Tug'] } }),
    });
    expect(await knowledgeOffer({ knowledgeUrl: 'http://knowledge:8086', fetchImpl })()).toEqual({ actions: ['retain', 'hold'], classes: ['kg:Ship', 'kg:Tug'] });
    expect(asked.sort()).toEqual(['http://knowledge:8086/v1/actions', 'http://knowledge:8086/v1/meta']);
  });

  it('takes the base classes from a knowledge graph that gives no others, and says why when it can’t be asked', async () => {
    const older = answering({
      '/v1/actions': () => Response.json({ actions: [{ name: 'retain' }] }),
      '/v1/meta': () => Response.json({ ontology: { baseClasses: ['kg:Ship'] } }),
    });
    expect(await knowledgeOffer({ knowledgeUrl: 'http://k', fetchImpl: older.fetchImpl })()).toEqual({ actions: ['retain'], classes: ['kg:Ship'] });
    const failing = answering({ '/v1/actions': () => new Response('', { status: 503 }), '/v1/meta': () => Response.json({ ontology: {} }) });
    expect(await knowledgeOffer({ knowledgeUrl: 'http://k', fetchImpl: failing.fetchImpl })()).toEqual({ unavailable: 'the knowledge graph answered HTTP 503.' });
    const down = (async () => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch;
    expect(await knowledgeOffer({ knowledgeUrl: 'http://k', fetchImpl: down })()).toEqual({ unavailable: 'the knowledge graph couldn’t be reached.' });
  });
});
