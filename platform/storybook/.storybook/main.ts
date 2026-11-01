import type { StorybookConfig } from '@storybook/react-vite';

/**
 * One Storybook for AUGUR's kits (ADR 0016). The React kits' stories live beside their parts;
 * the Lit kit, frozen until SDK 2, keeps its own Storybook, built into `lit/` and composed in
 * here, so one link shows everything while the parts move.
 */
const config: StorybookConfig = {
  stories: ['../../packages/{kit-common,app-kit,shell-kit}/src/**/*.stories.tsx'],
  framework: { name: '@storybook/react-vite', options: {} },
  refs: (_config, { configType }) =>
    configType === 'PRODUCTION' ? { lit: { title: 'Lit kit (frozen until SDK 2)', url: './lit', expanded: false } } : {},
};

export default config;
