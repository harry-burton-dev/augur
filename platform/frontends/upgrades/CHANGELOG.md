# @augur/upgrades

## 0.1.2

### Patch Changes

- 35547f6: The React kits (Common, Quill and Aerie) now come from the augur-kit repository as packages (ADR 0046), and are AUGUR release parts at the versions installed. Their Storybook and Chromatic run there.

## 0.1.1

### Patch Changes

- Updated dependencies [9e021dd]
  - @augur/app-kit@0.3.0

## 0.1.0

### Minor Changes

- 1743f40: Automatic waits until an admin has upgraded AUGUR on a server once, and a 0.x minor counts as a major for AUGUR and apps (ADR 0020, amended). ADR 0045 is accepted.
- 7dffd91: A watch too quiet to judge errors by keeps going lightly until AUGUR's services have had 20 calls, for up to a day. A problem it finds then shows in Needs you and doesn't go back by itself (ADR 0020, amended).
- 567b4ca: Upgrade AUGUR, go back, and install an app's release from the Upgrade Centre, then follow the upgrade step by step until it ends. When the registry asks for the password again, the page signs in again and comes back to the same question with what was typed kept for the tab.
- aa1546f: The Upgrade Centre's history lists AUGUR's upgrades, every app's installs and removals, and every change of settings with the sentence before and after, newest first. It filters by unit, by who started it (a person, By itself or Watch) and by outcome, and exports as CSV.
- 854b1c7: Start the Upgrade Centre frontend with its API client and state model: unit states, Needs you, maintenance windows, pins and the policy sentence.
- 57e4775: The Upgrade Centre reads the registry's overview: each unit's policy in a sentence, what Automatic will do next, the next window, and Needs you from the server. Marking a failed or went-back result looked at clears it for every admin.
- 860f90b: The Upgrade Centre draws on Quill: the app frame with a rail of units and History, a front page (Needs you, On offer, Worth knowing), an About drawer on each unit, and Common's buttons, choices, fields and select. Its name and icon come from the manifest.
- aa1546f: The Upgrade Centre shows how the deployment reports to Backstage: why it's on, off or file-only, its name in Backstage, the public key to copy into `augur.dev/report-key`, how the last send went, and an export of the signed record.
- 8b6525f: The Upgrade Centre opens as its own app at /upgrades (ADR 0030): an overview (Needs you, this deployment, units, next window, last checked), a page for AUGUR and each installed app (how it moves, what is on offer, going back) and the history. Changes still go through Admin, Upgrade Centre until the change flow ships.
- 3a56e07: Change a unit's settings from the Upgrade Centre: channel, Automatic / Ask first / Hold, how far Automatic goes, a pin, and weekly windows in a time zone. The sentence before and after, and the next three windows, show before saving.

  "I've looked at this" works for any admin again, as the registry allows; only changes need `deployment-admin`.

### Patch Changes

- d500567: Home is on React and Quill (ADR 0015): the same greeting, list of what needs you and glance cards. The Upgrade Centre's status marks are Quill's own, so it no longer loads the Lit kit.
- 3d000f8: After an upgrade to a newer release, the updater watches it for 10 minutes before calling it done: sign-in must keep answering and no more than 5% of the gateway's calls may fail (ADR 0020). If either fails it goes back by itself, unless a breaking release lies between, when it leaves the release running and says so. The registry asks for the watch with each forward upgrade, and the new watch step is listed.
- 6a7d54b: A server built from source (compose.build.yml) says so: the registry reports `running.build: 'source'`, and the Upgrade Centre and Admin show AUGUR as built from source, based on the last release, instead of looking like an out-of-date release.
- Updated dependencies [f8e9b46]
- Updated dependencies [2a827a0]
- Updated dependencies [d994d7b]
- Updated dependencies [2a827a0]
- Updated dependencies [2a827a0]
- Updated dependencies [2a827a0]
- Updated dependencies [2a827a0]
- Updated dependencies [527a413]
- Updated dependencies [f8e9b46]
- Updated dependencies [da54ae3]
- Updated dependencies [7c8027d]
- Updated dependencies [d500567]
- Updated dependencies [a8854e2]
- Updated dependencies [fccb126]
- Updated dependencies [d64d724]
  - @augur/kit-common@0.2.0
  - @augur/app-kit@0.2.0
  - @augur/mfe-sdk@1.10.0
