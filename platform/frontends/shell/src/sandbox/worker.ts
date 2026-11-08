/**
 * The bootstrap of every app's worker (spec 6.5): the SDK 3 runtime first (remote-dom's DOM in the
 * worker, the network taken away), then Quill's remote elements, then the bridge, which loads the
 * app's entry when the host says start. It is served with its own Content-Security-Policy
 * (`default-src 'none'; script-src 'self'`): the worker can load the app's modules from this origin
 * and reach nothing else. The page's import map doesn't reach a worker, so all of this is bundled here.
 */
import { runWorker } from '@augur/mfe-sdk/sdk3/runtime';
import { defineQuillElements } from '@augur/app-kit/remote';

defineQuillElements();
runWorker();
