import { createElement } from 'react';
import { jsx } from 'react/jsx-runtime';
import { describe, expect, it } from 'vitest';
import { Fragment, jsxDEV } from './jsx-dev-runtime';

describe('the production react/jsx-dev-runtime', () => {
  it('makes the same element as jsx, ignoring the development-only arguments', () => {
    const made = (jsxDEV as (...args: unknown[]) => unknown)('p', { className: 'x', children: 'hi' }, 'k', false, { fileName: 'a.tsx', lineNumber: 1 }, undefined);
    const expected = jsx('p', { className: 'x', children: 'hi' }, 'k');
    expect(made).toMatchObject({ type: 'p', key: 'k', props: { className: 'x', children: 'hi' } });
    expect(made).toEqual(expected);
  });

  it('exports Fragment', () => {
    expect(jsxDEV(Fragment, { children: createElement('span') })).toMatchObject({ type: Fragment });
  });
});
