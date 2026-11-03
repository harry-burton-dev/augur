/**
 * What the production import map serves for `react/jsx-dev-runtime`. React's
 * own production build of that module exports `jsxDEV` as undefined, so an
 * app built in development mode (or a library compiled that way) would fail
 * to render against a production shell. This one makes `jsxDEV` from `jsx`,
 * dropping the arguments only development builds read (source and self).
 * In dev the kit's development build serves the real one.
 */
import { Fragment, jsx } from 'react/jsx-runtime';

type Jsx = typeof jsx;

export { Fragment };

export const jsxDEV = (type: Parameters<Jsx>[0], props: Parameters<Jsx>[1], key?: Parameters<Jsx>[2]): ReturnType<Jsx> => jsx(type, props, key);
