// node --test scripts/*.test.mjs (pnpm test:scripts): the front door's TRUSTED_PROXIES, as the web image's entrypoint reads it.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../infra/deploy/trusted-proxies.envsh', import.meta.url));
/** What the script sets REAL_IP_FROM to for `value` (unset when undefined), and what it says. */
const run = (value) => {
  const env = { PATH: process.env.PATH, ...(value === undefined ? {} : { TRUSTED_PROXIES: value }) };
  const { stdout, stderr } = spawnSync('sh', ['-c', `. "${script}"; printf '%s' "$REAL_IP_FROM"`], { env, encoding: 'utf8' });
  return { from: stdout, said: stderr };
};

test('unset, it believes the private ranges and loopback, as the front door always has', () => {
  assert.equal(run(undefined).from, 'set_real_ip_from 10.0.0.0/8; set_real_ip_from 172.16.0.0/12; set_real_ip_from 192.168.0.0/16; set_real_ip_from 127.0.0.1; ');
  assert.equal(run('').from, run(undefined).from);
});

test('set, it believes only the addresses and ranges named, by space or comma, IPv4 or IPv6', () => {
  assert.equal(run('10.1.2.3, 10.20.0.0/16 fd00::/8').from, 'set_real_ip_from 10.1.2.3; set_real_ip_from 10.20.0.0/16; set_real_ip_from fd00::/8; ');
});

test('it leaves out what isn’t an address and says so, so nothing can be written into nginx’s config', () => {
  const { from, said } = run('10.0.0.1 example.org 10.0.0.0/8;deny all');
  assert.equal(from, 'set_real_ip_from 10.0.0.1; ');
  assert.match(said, /example\.org.*left out/);
  assert.match(said, /10\.0\.0\.0\/8;deny.*left out/);
});

test('it leaves out what only looks like an address, which nginx would refuse to start on', () => {
  for (const bad of ['10.0.0.256', '999.1.1.1', '10.0.0.0/33', ':', 'a:', 'fd00:::1', '1::2::3', 'fd00::/129', '10.0.0.0/8/8']) {
    assert.equal(run(bad).from, '', bad);
  }
  assert.equal(run('::1 2001:db8::/32 fe80::1:2:3:4').from, 'set_real_ip_from ::1; set_real_ip_from 2001:db8::/32; set_real_ip_from fe80::1:2:3:4; ');
});

test('none believes no one, quietly, for a front door with no proxy in front', () => {
  assert.deepEqual(run('none'), { from: '', said: '' });
});

test('an entry is never read as a file name', () => {
  const { said } = run('*');
  assert.equal(said.split('\n').filter(Boolean).length, 2, said);
  assert.match(said, /has \*, which/);
});

test('with nothing usable it believes no one, and says every caller then counts as the proxy', () => {
  const { from, said } = run('nonsense');
  assert.equal(from, '');
  assert.match(said, /believed from no one/);
});
