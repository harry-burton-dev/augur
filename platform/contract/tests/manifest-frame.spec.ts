import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * Starter, the app every app made from the app template starts as (augur-app-template, contract 3), drawn by the
 * shell from its manifest alone (spec 6): its tile in the app bar, its places in the rail (when it has more than one) and its commands in its
 * pane's heading come before any of its code runs, and here none does. `starter/manifest.json` is a copy of the
 * template's; refresh it when the template's manifest changes.
 */
interface Manifest {
  id: string;
  name: string;
  contributes: { places: { id: string; label: string; path?: string; fills?: boolean }[]; commands: { id: string; label: string }[] };
}
const starter = JSON.parse(readFileSync(new URL('../starter/manifest.json', import.meta.url), 'utf8')) as Manifest;

// The second dev server compiles the shell on its first page; its first state may take that long (the reference
// app's are warmed by warm.setup.ts).
const COLD = 120_000;

test('the shell draws Starter’s frame from its manifest before any of its code runs', async ({ page }) => {
  await page.goto('/');
  const desk = page.getByRole('navigation', { name: 'App bar', exact: true });
  await desk.getByRole('button', { name: 'Apps', exact: true }).click({ timeout: COLD });
  await page.getByRole('menu', { name: 'Apps' }).getByRole('menuitem', { name: new RegExp(starter.name) }).click();
  await expect(page).toHaveURL(new RegExp(`/@me/${starter.id}$`));
  const rail = page.getByRole('navigation', { name: `App bar: ${starter.name}` });
  await expect(rail.getByRole('button', { name: `${starter.name}, you’re here` })).toBeVisible();
  // The rail lists its places only when there's a choice: two or more, or one the app fills (PDR-020 D2).
  const places = starter.contributes.places;
  const pages = rail.locator('.aerie-bar-pages');
  if (places.length >= 2 || places.some((p) => p.fills)) for (const place of places) await expect(pages.getByRole('button', { name: place.label })).toBeVisible();
  else await expect(pages.getByRole('button')).toHaveCount(0);
  const pane = page.locator(`[data-app="${starter.id}"]`).first();
  for (const command of starter.contributes.commands) await expect(pane.getByRole('button', { name: command.label })).toBeVisible();
});
