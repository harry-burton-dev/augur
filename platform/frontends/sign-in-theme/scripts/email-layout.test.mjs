// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fillTokens } from './email-layout.mjs';

describe('the email layout', () => {
  it('gets every value from Common’s tokens, and stops on a name that isn’t one', () => {
    const filled = fillTokens(readFileSync(new URL('../email-layout.ftl', import.meta.url), 'utf8'));
    expect(filled).not.toMatch(/\{\{/);
    expect(filled).toContain('<#macro emailLayout>');
    expect(() => fillTokens('{{no-such-token}}')).toThrow('no-such-token');
  });
});
