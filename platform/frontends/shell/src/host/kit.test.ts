import { describe, expect, it } from 'vitest';
import { pageKit, versionLine } from './kit.js';

const page = (content?: string) => {
  const doc = document.implementation.createHTMLDocument();
  if (content !== undefined) {
    const meta = doc.createElement('meta');
    meta.name = 'augur-kit';
    meta.content = content;
    doc.head.append(meta);
  }
  return doc;
};

describe('the kit the page loads', () => {
  it('is read from the page', () => {
    expect(pageKit(page('{"version":"0.1.0","url":"https://cdn.example.org/kit/0.1.0/"}'))).toEqual({ version: '0.1.0', url: 'https://cdn.example.org/kit/0.1.0/' });
  });

  it('is unknown when the page names none, or garbles it', () => {
    expect(pageKit(page())).toBeUndefined();
    expect(pageKit(page('not json'))).toBeUndefined();
    expect(pageKit(page('{"version":1}'))).toBeUndefined();
  });

  it('shows in the version line, after the shell and the SDK', () => {
    expect(versionLine('0.14.0', '1.10.0', { version: '0.1.0', url: '/kit/0.1.0/' })).toBe('0.14.0 · SDK 1.10.0 · kit 0.1.0 from /kit/0.1.0/');
    expect(versionLine('0.14.0', '1.10.0', undefined)).toBe('0.14.0 · SDK 1.10.0');
  });
});
