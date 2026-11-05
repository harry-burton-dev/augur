import { AppFrame, iconNames, RailLink, type IconName } from '@augur/app-kit';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminApi, CatalogueApp } from './api.js';
import { Activity } from './activity.js';
import { Apps } from './apps.js';
import { Departments } from './departments.js';
import { Pipeline } from './line.js';
import { Organisation } from './organisation.js';
import { People } from './people.js';
import { Status } from './status.js';

const screens = ['people', 'departments', 'apps', 'organisation', 'status', 'updates', 'activity'] as const;
export type Screen = (typeof screens)[number];

/** Which screen a path inside Admin opens. Its Orbit lives at "/", so anything else falls back to People. */
export const screenFor = (path: string): { screen: Screen; adding: boolean } => {
  const [first, second] = path.split('/').filter(Boolean);
  const screen = screens.find((s) => s === first) ?? 'people';
  return { screen, adding: second === 'new' };
};

/** Admin's sections, as its rail shows them. */
const RAIL: { screen: Screen; label: string; icon: IconName }[] = [
  { screen: 'people', label: 'People', icon: 'people' },
  { screen: 'departments', label: 'Departments', icon: 'department' },
  { screen: 'apps', label: 'Apps', icon: 'apps' },
  { screen: 'organisation', label: 'Organisation', icon: 'org' },
  { screen: 'status', label: 'Status', icon: 'gauge' },
  { screen: 'updates', label: 'Dev to production', icon: 'pulse' },
  { screen: 'activity', label: 'Activity', icon: 'clock' },
];

/** This app's id in the catalogue, where its name and icon come from, and the Upgrade Centre's (ADR 0030). */
const APP_ID = 'admin';
const UPGRADES_ID = 'upgrades';

const iconOf = (name: string | undefined, fallback: IconName): IconName => (name && (iconNames as readonly string[]).includes(name) ? (name as IconName) : fallback);

/** Goes somewhere the shell owns (another app, or Admin's Orbit): it moves the address and tells the shell, which follows it like Back. */
const shellTo = (href: string) => {
  window.history.pushState(window.history.state, '', href);
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
};

/**
 * Admin: people, departments, apps, and the platform's status, line and
 * activity, so nobody needs the sign-in service's own console or the command
 * line. Every change goes through the platform's services, which check the
 * caller is an admin and record it in the audit log. Moving between its
 * sections moves the address without the shell mounting it again.
 */
export function AdminApp({ api, me, roles = [], path: start }: { api: AdminApi; me: string; roles?: string[]; path: string }) {
  const [path, setPath] = useState(start || '/');
  const [catalogue, setCatalogue] = useState<CatalogueApp[]>([]);
  useEffect(() => {
    api.apps().then(setCatalogue, () => setCatalogue([]));
  }, [api]);
  // Where Admin is mounted: the address without the path inside it.
  const base = useMemo(() => {
    const here = window.location.pathname;
    return start && start !== '/' && here.endsWith(start) ? here.slice(0, here.length - start.length) : here.replace(/\/$/, '');
  }, [start]);
  useEffect(() => {
    const back = () => window.location.pathname.startsWith(base) && setPath(window.location.pathname.slice(base.length) || '/');
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, [base]);
  const go = useCallback(
    (to: string) => {
      window.history.pushState(window.history.state, '', `${base}${to}`);
      setPath(to);
    },
    [base],
  );

  const self = catalogue.find((a) => a.id === APP_ID);
  const upgrades = catalogue.find((a) => a.id === UPGRADES_ID);
  // The floor's prefix is what's left of the base once Admin's own route comes off it.
  const prefix = self && base.endsWith(self.route) ? base.slice(0, base.length - self.route.length) : base.replace(/\/[^/]*$/, '');
  const openUpgrades = () => shellTo(`${prefix}${upgrades?.route ?? `/${UPGRADES_ID}`}`);
  const { screen, adding } = screenFor(path);

  return (
    <div className="admin-app" data-admin>
      <AppFrame
        app={{ name: self?.name ?? APP_ID, icon: iconOf(self?.icon, 'admin') }}
        onFront={() => shellTo(base)}
        railLabel="Sections"
        rail={
          <>
            {RAIL.map((r) => (
              <RailLink key={r.screen} icon={r.icon} label={r.label} current={screen === r.screen} onPress={() => go(`/${r.screen}`)} />
            ))}
            {upgrades ? <RailLink icon={iconOf(upgrades.icon, 'download')} label={upgrades.name} onPress={openUpgrades} /> : null}
          </>
        }
        screen={screen}
      >
        {screen === 'people' ? (
          <People key={path} api={api} me={me} adding={adding} />
        ) : screen === 'departments' ? (
          <Departments key={path} api={api} adding={adding} />
        ) : screen === 'apps' ? (
          <Apps api={api} openUpgrades={openUpgrades} upgradesName={upgrades?.name ?? 'Upgrade Centre'} />
        ) : screen === 'organisation' ? (
          <Organisation api={api} roles={roles} />
        ) : screen === 'status' ? (
          <Status api={api} openUpgrades={openUpgrades} />
        ) : screen === 'updates' ? (
          <Pipeline api={api} openUpgrades={openUpgrades} />
        ) : (
          <Activity api={api} />
        )}
      </AppFrame>
    </div>
  );
}
