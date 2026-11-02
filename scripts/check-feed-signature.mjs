// Checks the feed just signed the way every deployment will: the registry's own cosign check, with the
// signer identity it expects of this repository (platform/services/registry/src/feed-trust.ts). A
// mismatch between how the workflow signs and what deployments accept would make every deployment
// refuse the feed, so it fails here first (ADR 0017; PER-201).
//
//   node --experimental-strip-types scripts/check-feed-signature.mjs <feed.json> <owner/repo>
import { readFile } from 'node:fs/promises';
import { cosignFeedCheck, feedSigner } from '../platform/services/registry/src/feed-trust.ts';

const [feed, repo] = process.argv.slice(2);
if (!feed || !repo) {
  console.error('usage: node --experimental-strip-types scripts/check-feed-signature.mjs <feed.json> <owner/repo>');
  process.exit(2);
}
const identity = feedSigner(repo);
try {
  await cosignFeedCheck({ identity })(await readFile(feed, 'utf8'), await readFile(`${feed}.sigstore.json`, 'utf8'));
  console.log(`The feed's signature checks out as deployments check it (${identity}).`);
} catch (err) {
  console.error(`Deployments would refuse this feed: ${err.message}`);
  process.exit(1);
}
