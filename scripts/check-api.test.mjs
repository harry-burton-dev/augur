import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foreignImports, pendingBump, requiredBump } from './check-api.mjs';

const report = (body) => `## API Report File for "@augur/x"\n\n\`\`\`ts\n${body}\n\n// (No @packageDocumentation comment for this package)\n\`\`\`\n`;

test('a report may name only our own packages', () => {
  const text = report("import { ReactNode } from 'react';\nimport { Ref } from '@augur/kit-common';\n\n// @public\nexport const a: number;");
  assert.deepEqual(foreignImports(text), ['react']);
});

test('the service kit may name Fastify and jose, and nothing else foreign', () => {
  const text = report("import type { FastifyInstance } from 'fastify';\nimport { JWTVerifyGetKey } from 'jose';\nimport { Transporter } from 'nodemailer';\n\n// @public\nexport const a: number;");
  assert.deepEqual(foreignImports(text, '@augur/service-kit'), ['nodemailer']);
  assert.deepEqual(foreignImports(text, '@augur/mfe-sdk'), ['fastify', 'jose', 'nodemailer']);
});

test('additions need a minor, removals and changes a major', () => {
  const before = report('// @public\nexport interface A {\n    id: string;\n}');
  assert.equal(requiredBump(before, before), 'none');
  assert.equal(requiredBump(before, report('// @public\nexport interface A {\n    // (undocumented)\n    id: string;\n    name?: string;\n}')), 'minor');
  assert.equal(requiredBump(before, report('// @public\nexport interface A {\n    id?: string;\n}')), 'major');
});

test('reads the bump pending changesets give a package', () => {
  const sets = ['---\n"@augur/mfe-sdk": minor\n"@augur/shell": patch\n---\n\nAdds a thing.\n', '---\n"@augur/shell": major\n---\n\nOther.\n'];
  assert.deepEqual(pendingBump(sets, '@augur/mfe-sdk'), { bump: 'minor', notBreaking: false });
  assert.deepEqual(pendingBump(sets, '@augur/records'), { bump: 'none', notBreaking: false });
  assert.equal(pendingBump(['---\n"@augur/mfe-sdk": minor\n---\n\nWidens a type.\n\nNot breaking: id accepts more.\n'], '@augur/mfe-sdk').notBreaking, true);
});
