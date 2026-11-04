#!/usr/bin/env node
// Holds the deployment's settings to infra/deploy/settings.schema.json, where each is described once
// (docs/deploy.md, "Settings and secrets"). Fails when:
//   - a setting doesn't reach a service that reads it in infra/deploy/compose.yml (or the file its
//     `x-via` names), and the service has no env_file;
//   - compose.yml makes a setting required (${KEY:?...}) that the schema doesn't, or the other way;
//   - .env.example leaves a deployment setting out, or lists one the schema doesn't know;
//   - a setting's guide section (`x-docs`) doesn't exist or doesn't name it;
//   - a service's code reads a setting the schema doesn't have, or doesn't list that service for;
//   - a default, in the schema or compose.yml, hard-codes one deployment (an owner, a tailnet host,
//     an email address) where the setting should be required or worked out.
//   node scripts/check-settings.mjs
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';

const root = new URL('..', import.meta.url).pathname;

/** Ids kept on purpose so live servers keep working (AGENTS.md, Names): not a deployment's literal. */
export const KEPT_IDS = ['ghcr.io/harry-burton-dev/im-platform'];
/** What the operating system sets, not AUGUR. */
const OS_KEYS = new Set(['PATH', 'HOME', 'HOSTNAME']);

const keyPattern = '[A-Z][A-Z0-9_]*';

/** A compose file's services, each with its environment (merges resolved) and whether it has an env_file. */
export const composeServices = (text) => {
  const doc = parse(text, { merge: true }) ?? {};
  const services = {};
  for (const [name, service] of Object.entries(doc.services ?? {})) {
    let env = service?.environment ?? {};
    if (Array.isArray(env)) env = Object.fromEntries(env.map((line) => [String(line).split('=')[0], String(line).split('=').slice(1).join('=')]));
    services[name] = { image: service?.image, environment: Object.fromEntries(Object.entries(env).map(([k, v]) => [k, v == null ? '' : String(v)])), envFile: Boolean(service?.env_file) };
  }
  return services;
};

const refers = (value, key) => new RegExp(`\\$\\{${key}(?=[}:?-])`).test(value);

/** Whether `key` reaches `service`: by name for an internal setting, from .env (or an env_file) otherwise. */
const reaches = (service, key, internal) =>
  internal ? key in service.environment : service.envFile || Object.values(service.environment).some((v) => refers(v, key));

/** The keys .env.example lists, set or commented out. */
export const envExampleKeys = (text) => [...text.matchAll(new RegExp(`^#?\\s*(${keyPattern})=`, 'gm'))].map((m) => m[1]);

/** A heading's anchor, as GitHub makes it. */
export const slug = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/ /g, '-');

/** The text of the section `anchor` names in a Markdown file, up to the next heading at its level or above. */
export const section = (markdown, anchor) => {
  const lines = markdown.split('\n');
  let fenced = false;
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) fenced = !fenced;
    const heading = !fenced && /^(#{1,6}) (.*)$/.exec(lines[i]);
    if (!heading) continue;
    if (start >= 0 && heading[1].length <= level) return lines.slice(start, i).join('\n');
    if (start < 0 && slug(heading[2].replace(/`/g, '')) === anchor) {
      start = i;
      level = heading[1].length;
    }
  }
  return start >= 0 ? lines.slice(start).join('\n') : undefined;
};

/** Every setting a service's code reads by name. */
export const keysRead = (code) => {
  const found = new Set();
  const add = (re) => {
    for (const m of code.matchAll(re)) found.add(m[1]);
  };
  add(new RegExp(`\\benv\\.(${keyPattern})\\b`, 'g'));
  add(new RegExp(`\\benv\\[\\s*['"\`](${keyPattern})['"\`]\\s*\\]`, 'g'));
  add(new RegExp(`\\{\\s*name:\\s*'(${keyPattern})'`, 'g'));
  add(new RegExp(`\\bsetting\\(\\s*'(${keyPattern})'`, 'g'));
  add(new RegExp(`\\benvValue\\([^;\\n]*?,\\s*'(${keyPattern})'\\s*\\)`, 'g'));
  for (const m of code.matchAll(/\bconst\s*\{([^}]*)\}\s*=\s*(?:process\.)?env\b/g)) {
    for (const part of m[1].split(',')) {
      const name = new RegExp(`^\\s*(${keyPattern})\\b`).exec(part);
      if (name) found.add(name[1]);
    }
  }
  for (const key of OS_KEYS) found.delete(key);
  return [...found];
};

/** What in `value` hard-codes one deployment, if anything. */
export const deploymentLiterals = (value) => {
  let text = String(value);
  for (const kept of KEPT_IDS) text = text.split(kept).join('');
  const found = [];
  if (/harry-burton-dev/.test(text)) found.push('this GitHub owner');
  if (/[a-z0-9-]+\.ts\.net\b/i.test(text)) found.push('a tailnet host');
  const email = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(text);
  if (email && !/@example\.(org|com|net)$/.test(email[0])) found.push('an email address');
  return found;
};

const strings = (node, out = []) => {
  if (typeof node === 'string') out.push(node);
  else if (node && typeof node === 'object') for (const v of Object.values(node)) strings(v, out);
  return out;
};

/**
 * Every problem with the settings, given the files' contents: `files` maps a path (relative to the
 * repository) to its text, and `code` maps each service (or `service-kit`) to its source.
 */
export const settingsProblems = ({ schema, files, code }) => {
  const problems = [];
  const properties = schema.properties ?? {};
  const patterns = Object.entries(schema.patternProperties ?? {}).map(([p, s]) => [new RegExp(p), s]);
  const required = new Set(schema.required ?? []);
  const lookup = (key) => properties[key] ?? patterns.find(([re]) => re.test(key))?.[1];
  const composeText = files['infra/deploy/compose.yml'];
  const services = composeServices(composeText);
  const otherCompose = {};
  const servicesIn = (file) => (otherCompose[file] ??= files[file] === undefined ? undefined : composeServices(files[file]));

  for (const [key, setting] of Object.entries(properties)) {
    const internal = Boolean(setting['x-internal']);
    for (const name of setting['x-services'] ?? []) {
      if (name === 'compose') {
        if (!key.startsWith('COMPOSE_') && !refers(composeText, key)) problems.push(`${key}: compose.yml never uses it, though the schema says Compose reads it.`);
        continue;
      }
      const service = services[name];
      if (!service) problems.push(`${key}: compose.yml has no service ${name}.`);
      else if (!reaches(service, key, internal)) problems.push(`${key}: ${name} reads it, but compose.yml doesn't pass it to ${name}.`);
    }
    for (const [name, via] of Object.entries(setting['x-via'] ?? {})) {
      if (via === '.env' || via === 'default') continue;
      const other = servicesIn(via);
      if (!other) problems.push(`${key}: ${via} (its x-via for ${name}) doesn't exist.`);
      else if (!other[name] || !reaches(other[name], key, internal)) problems.push(`${key}: ${via} doesn't pass it to ${name}.`);
    }
    if (!internal) {
      const composeRequires = new RegExp(`\\$\\{${key}:\\?`).test(composeText);
      if (composeRequires && !required.has(key)) problems.push(`${key}: compose.yml requires it, but the schema doesn't list it as required.`);
      if (!composeRequires && required.has(key)) problems.push(`${key}: the schema requires it, but compose.yml doesn't (\${${key}:?...}).`);
    }
  }
  for (const key of required) if (!properties[key]) problems.push(`${key}: required, but not described.`);

  // .env.example: every deployment setting, and nothing the schema doesn't know.
  const listed = new Set(envExampleKeys(files['infra/deploy/.env.example']));
  for (const [key, setting] of Object.entries(properties)) {
    if (!setting['x-internal'] && !listed.has(key)) problems.push(`${key}: not in .env.example.`);
    if (setting['x-internal'] && listed.has(key)) problems.push(`${key}: in .env.example, but the schema says nobody sets it (x-internal).`);
  }
  for (const key of listed) if (!lookup(key)) problems.push(`${key}: in .env.example, but not in settings.schema.json.`);

  // The guides: each deployment setting is named in the section that explains it.
  for (const [key, setting] of [...Object.entries(properties), ...patterns.map(([re, s]) => [re.source, s])]) {
    const docs = setting['x-docs'];
    if (!docs) {
      if (!setting['x-internal']) problems.push(`${key}: no x-docs naming the guide section that explains it.`);
      continue;
    }
    const [file, anchor] = docs.split('#');
    if (files[file] === undefined) {
      problems.push(`${key}: ${file} (its x-docs) doesn't exist.`);
      continue;
    }
    const text = section(files[file], anchor ?? '');
    if (text === undefined) problems.push(`${key}: ${file} has no section #${anchor}.`);
    else if (properties[key] && !new RegExp(`\\b${key}\\b`).test(text)) problems.push(`${key}: ${docs} doesn't mention it.`);
  }

  // The services' code: everything it reads is described, for that service, or for another compose
  // service that runs the same image (identity's realm job runs as keycloak-config, ADR 0057).
  const runningImage = (pkg) => [pkg, ...Object.entries(services).filter(([, s]) => new RegExp(`/${pkg}:`).test(String(s?.image ?? ''))).map(([name]) => name)];
  for (const [service, source] of Object.entries(code)) {
    const names = runningImage(service);
    for (const key of keysRead(source)) {
      const setting = lookup(key);
      if (!setting) problems.push(`${key}: ${service} reads it, but it isn't in settings.schema.json.`);
      else if (service !== 'service-kit' && !names.some((n) => (setting['x-services'] ?? []).includes(n) || n in (setting['x-via'] ?? {})))
        problems.push(`${key}: ${service} reads it, but the schema doesn't list ${names.join(' or ')} (x-services or x-via).`);
    }
  }

  // Defaults that hard-code one deployment.
  const defaults = [...Object.entries(properties), ...patterns.map(([re, s]) => [re.source, s])].filter(([, s]) => 'default' in s);
  for (const [key, setting] of defaults)
    for (const what of deploymentLiterals(setting.default)) problems.push(`${key}: its default in the schema hard-codes ${what}; make it required or work it out.`);
  for (const value of strings(parse(composeText, { merge: true })))
    for (const what of deploymentLiterals(value)) problems.push(`compose.yml hard-codes ${what} in "${value}"; make it a setting that's required or worked out.`);

  return problems;
};

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) out.push(path);
  }
  return out;
};

const read = (path) => readFileSync(join(root, path), 'utf8');

if (import.meta.url === `file://${process.argv[1]}`) {
  const schema = JSON.parse(read('infra/deploy/settings.schema.json'));
  const files = {};
  const want = ['infra/deploy/compose.yml', 'infra/deploy/.env.example'];
  for (const s of [...Object.values(schema.properties), ...Object.values(schema.patternProperties ?? {})]) {
    if (s['x-docs']) want.push(s['x-docs'].split('#')[0]);
    for (const via of Object.values(s['x-via'] ?? {})) if (via !== '.env' && via !== 'default') want.push(via);
  }
  for (const path of new Set(want)) if (existsSync(join(root, path))) files[path] = read(path);
  const code = {};
  const servicesDir = join(root, 'platform/services');
  for (const service of readdirSync(servicesDir)) {
    const src = join(servicesDir, service, 'src');
    if (existsSync(src)) code[service] = walk(src).map((f) => readFileSync(f, 'utf8')).join('\n');
  }
  code['service-kit'] = walk(join(root, 'platform/packages/service-kit/src')).map((f) => readFileSync(f, 'utf8')).join('\n');

  const problems = settingsProblems({ schema, files, code });
  if (problems.length) {
    console.error(`${problems.length} problem(s) with the deployment's settings (infra/deploy/settings.schema.json):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`check:settings: ${Object.keys(schema.properties).length} settings, each reaching its services, listed and documented (${relative(root, join(root, 'infra/deploy/settings.schema.json'))}).`);
}
