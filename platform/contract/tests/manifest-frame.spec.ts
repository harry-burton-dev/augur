import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * Starter, the app every app made from the app template starts as (augur-app-template, contract 3), drawn by the
 * shell from its manifest alone (spec 6): its tile in the app bar, its places in the rail (when there's a choice of
 * them), and its pane, headed with its name and saying it's opening or why it stopped, come before any of its code
 * runs, and here none does. Its commands reach the palette and the heading only once its code runs (contract.spec.ts).
 * `starter/manifest.json` is a copy of the template's; refresh it when the template's manifest changes.
 */
interface Manifest {
  id: string;
  name: string;
  contributes: { places: { id: string; label: string; path?: string; fills?: boolean }[] };
}
const starter = JSON.parse(readFileSync(new URL('../starter/manifest.json', import.meta.url), 'utf8')) as Manifest;

// The second dev server compiles the shell on its first page; its first state may take that long (the reference
// app's are warmed by warm.setup.ts).
const COLD = 120_000;

test('the shell draws Starter’s frame from its manifest before any of its code runs', async ({ page }) => {
  await page.goto('/');
  const desk = page.getByRole('navigation', { name: 'App bar', exact: true });
  // The desktop holds Home, so Starter is the one other app, offered as a tile beside the logo.
  await desk.getByRole('button', { name: new RegExp(`^${starter.name}`) }).click({ timeout: COLD });
  await expect(page).toHaveURL(new RegExp(`/@me/${starter.id}$`));
  const rail = page.getByRole('navigation', { name: `App bar: ${starter.name}` });
  await expect(rail.getByRole('button', { name: `${starter.name}, you’re here` })).toBeVisible();
  // The rail lists its places only when there's a choice: two or more, or one the app fills (PDR-020 D2).
  const places = starter.contributes.places;
  const pages = rail.locator('.aerie-bar-pages');
  if (places.length >= 2 || places.some((p) => p.fills)) for (const place of places) await expect(pages.getByRole('button', { name: place.label })).toBeVisible();
  else await expect(pages.getByRole('button')).toHaveCount(0);
  const pane = page.locator(`[data-app="${starter.id}"]`).first();
  await expect(pane.getByRole('heading', { name: starter.name, exact: true })).toBeVisible();
  // With no code to run, it says so rather than showing nothing.
  const name = starter.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const said = new RegExp(`Opening ${name}|${name} is taking a while to open|${name} stopped`);
  await expect(pane.getByRole('status').or(pane.getByRole('alert')).filter({ hasText: said }).first()).toBeVisible();
});
