#!/usr/bin/env node
// The public surface of each published library, as API Extractor reports it, checked in CI (ADR 0052).
//
// A library opts in with an api-extractor*.json beside its package.json (one per entry point); each writes a
// report to the package's etc/ folder, which is committed. Then:
//   - the report must match what the built types say (run `pnpm api:update` after changing an export);
//   - the report may name no type from another package: the SDK wraps third-party libraries, so their
//     next major never forces ours (alpha spec, goal 1);
//   - a pull request that changes a report needs a changeset for that package of the right size: a minor
//     for additions, a major when anything is taken away or changed, unless the changeset explains with a
//     line starting "Not breaking:" (a widened type, say).
//
// node scripts/check-api.mjs [update]   Needs the packages built (pnpm build). BASE_REF names the branch
// a pull request goes into; without it the changeset rule is skipped.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const LIBRARIES = 'platform/packages';
const RANK = { none: 0, patch: 1, minor: 2, major: 3 };

/** Packages that may appear in a report: our own. */
const isOwn = (spec) => spec.startsWith('@augur/') || spec.startsWith('.');

/**
 * Third-party modules a package's report may still name, each with why (ADR 0052, amended 5 Nov). The SDK and
 * the records package may name none. The service kit is how a service is built on Fastify (ADR 0005), so its
 * handlers and hooks take Fastify's own types, and its caller checks take jose's key types, the JOSE standard's.
 */
export const ALLOWED_FOREIGN = {
  '@augur/service-kit': ['fastify', 'jose'],
};

/** Third-party modules a report imports types from, less those `name` may name. */
export function foreignImports(report, name) {
  const allowed = new Set(ALLOWED_FOREIGN[name] ?? []);
  return [...report.matchAll(/^import\s.*?\sfrom\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]).filter((s) => !isOwn(s) && !allowed.has(s));
}

/** The lines of a report that carry API, without API Extractor's comments and blank lines. */
const apiLines = (report) =>
  report
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('>') && !l.startsWith('##') && l !== '```' && l !== '```ts');

/** The bump a report change needs: none, minor (only additions) or major (anything taken away or changed). */
export function requiredBump(before, after) {
  if (before === after) return 'none';
  if (before == null) return 'minor';
  const now = new Set(apiLines(after));
  const removed = apiLines(before).filter((l) => !now.has(l));
  return removed.length ? 'major' : 'minor';
}

/** The bump pending changesets give a package, and whether one says a removal isn't breaking. */
export function pendingBump(changesets, name) {
  let bump = 'none';
  let notBreaking = false;
  for (const text of changesets) {
    const front = /^---\n([\s\S]*?)\n---/.exec(text);
    if (!front) continue;
    for (const line of front[1].split('\n')) {
      const m = /^\s*["']?([^"':]+)["']?\s*:\s*(patch|minor|major)\s*$/.exec(line);
      if (m && m[1] === name) {
        if (RANK[m[2]] > RANK[bump]) bump = m[2];
        if (/^Not breaking:/m.test(text.slice(front[0].length))) notBreaking = true;
      }
    }
  }
  return { bump, notBreaking };
}

/** Each library's API Extractor configs and the report each writes. */
export function reports(base = root) {
  const dir = join(base, LIBRARIES);
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      const pkgDir = join(dir, d.name);
      if (!existsSync(join(pkgDir, 'package.json'))) return [];
      const name = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).name;
      return readdirSync(pkgDir)
        .filter((f) => /^api-extractor(\.[\w-]+)?\.json$/.test(f))
        .map((config) => {
          const text = readFileSync(join(pkgDir, config), 'utf8');
          const file = /"reportFileName"\s*:\s*"([^"]+)"/.exec(text)?.[1] ?? '<unscopedPackageName>';
          return { name, pkgDir, config, report: join(LIBRARIES, d.name, 'etc', `${file}.api.md`) };
        });
    });
}

/** How the built types differ from the committed report: API Extractor leaves what it found in dist/api/. */
function reportDiff(report, pkgDir) {
  const found = join(pkgDir, 'dist', 'api', report.split('/').pop());
  if (!existsSync(found)) return '';
  try {
    execFileSync('diff', ['-u', join(root, report), found], { stdio: 'pipe', encoding: 'utf8' });
    return '';
  } catch (err) {
    return String(err.stdout ?? '').split('\n').slice(0, 60).join('\n');
  }
}

function main() {
  const update = process.argv[2] === 'update';
  const problems = [];
  const bin = join(root, 'node_modules', '.bin', 'api-extractor');
  const list = reports();
  for (const { name, pkgDir, config, report } of list) {
    // A library's first report needs its etc/ folder.
    if (update) mkdirSync(join(root, report, '..'), { recursive: true });
    try {
      execFileSync(bin, ['run', '--config', config, ...(update ? ['--local'] : [])], { cwd: pkgDir, stdio: 'pipe', encoding: 'utf8' });
    } catch (err) {
      problems.push(`${report}: doesn't match the built types. Run pnpm build && pnpm api:update, and commit it.\n${err.stdout ?? ''}\n${reportDiff(report, pkgDir)}`.trim());
      continue;
    }
    const foreign = foreignImports(readFileSync(join(root, report), 'utf8'), name);
    if (foreign.length) problems.push(`${report}: names types from ${[...new Set(foreign)].join(', ')}. Wrap them in our own types.`);
  }

  const baseRef = process.env.BASE_REF;
  if (baseRef && !update) {
    const dir = join(root, '.changeset');
    const changesets = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md').map((f) => readFileSync(join(dir, f), 'utf8'));
    for (const { name, report } of list) {
      let before = null;
      try {
        before = execFileSync('git', ['show', `origin/${baseRef}:${report}`], { cwd: root, stdio: 'pipe', encoding: 'utf8' });
      } catch {
        // A new report: it adds, so a minor.
      }
      const needed = requiredBump(before, readFileSync(join(root, report), 'utf8'));
      if (needed === 'none' || before == null) continue;
      const { bump, notBreaking } = pendingBump(changesets, name);
      const enough = RANK[bump] >= RANK[needed] || (needed === 'major' && bump === 'minor' && notBreaking);
      if (!enough) {
        problems.push(
          `${report} changed, so ${name} needs a ${needed} changeset (it has ${bump}).` +
            (needed === 'major' ? ' If nothing an app uses breaks, a minor with a line "Not breaking: <why>" will do.' : ''),
        );
      }
    }
  }

  if (problems.length) {
    console.error(`API check failed:\n${problems.map((p) => `  ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`API ${update ? 'reports written' : 'check passed'}: ${list.map((r) => r.report).join(', ')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
