// The rule check:versions holds for dependency versions (pnpm catalogs, PER-166): a dependency that two or
// more of AUGUR's packages name asks for `catalog:` and takes its range from pnpm-workspace.yaml.

const FIELDS = ['dependencies', 'devDependencies'];
/** Specs that point somewhere other than the registry, or at AUGUR's own repositories, and so stay as they are. */
const OWN_SPEC = /^(workspace:|npm:|file:|link:|git|https?:)/;

/**
 * What breaks the rule, as sentences: `packages` maps each package.json's path to its contents, `catalog` is
 * pnpm-workspace.yaml's catalog.
 */
export function catalogProblems(packages, catalog) {
  const problems = [];
  const users = new Map();
  for (const [path, pkg] of Object.entries(packages)) {
    for (const field of FIELDS) {
      for (const [name, spec] of Object.entries(pkg[field] ?? {})) {
        if (spec === 'catalog:') {
          if (!(name in catalog)) problems.push(`${path}: ${name} asks for catalog:, but pnpm-workspace.yaml's catalog has no ${name}`);
          continue;
        }
        if (OWN_SPEC.test(spec)) continue;
        if (!users.has(name)) users.set(name, []);
        users.get(name).push(path);
      }
    }
  }
  for (const [name, paths] of users) {
    const all = [...new Set(paths)];
    if (name in catalog) problems.push(`${all.join(', ')}: ${name} is in the catalog, so ask for "catalog:" instead of a range`);
    else if (all.length > 1) problems.push(`${all.join(', ')}: ${name} is named by ${all.length} packages, so put its range in pnpm-workspace.yaml's catalog and ask for "catalog:"`);
  }
  return problems;
}

/** The catalog entries a diff of pnpm-workspace.yaml adds, removes or changes. */
export function changedCatalogEntries(diff) {
  const names = new Set();
  let inCatalog = false;
  for (const line of diff.split('\n')) {
    const body = line.slice(1);
    if (/^\S/.test(body)) inCatalog = body.startsWith('catalog:');
    if (!inCatalog || !/^[+-]/.test(line) || /^(\+\+\+|---)/.test(line)) continue;
    const entry = /^\s+"?([^":\s]+)"?:/.exec(body);
    if (entry) names.add(entry[1]);
  }
  return [...names].sort();
}

/** The packages (by name) whose package.json asks the catalog for any of `names`. */
export function catalogUsers(names, packages) {
  const wanted = new Set(names);
  return Object.values(packages)
    .filter((pkg) => FIELDS.some((field) => Object.entries(pkg[field] ?? {}).some(([name, spec]) => spec === 'catalog:' && wanted.has(name))))
    .map((pkg) => pkg.name)
    .sort();
}
