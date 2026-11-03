# Concepts found by this run

Each is bigger than one prototype and could steer a future run. They are also filed in `design-lab/concepts/`.

## Answer, don't announce (`answer-not-announce`)

AUGUR stays silent and only things that wait for you answer: on arrival, when you ask, or when something you are waiting on changes. Sound marks a change of state, never the state itself, and background work is heard only on demand.

Evidence: floors V6, ambient V4 and V6, combined V1 and V3.

Could steer: Notifications, presence, Home.

## The shell owns loudness (`shell-owns-loudness`)

Apps raise a notice at a level; only the shell decides whether and how loudly it reaches a person (light, sound, toast), under one budget. Extends ADR 0044's levels from visual loudness to every channel.

Evidence: grammar V1, combined V1 and V4.

Could steer: Notifications contract; control room (E).

## Subtraction as cue (`subtraction-as-cue`)

Take something away before an event (sound, light, motion) so the absence is the signal. A beat of silence before urgent says more than a louder ding.

Evidence: urgent V2 and V6, floors V4, combined V2.

Could steer: Letterbox, cinematic focus pulls, diegetic (G).

## Question and answer (`question-and-answer`)

Acknowledge, act and resolve are different states, and each is heard and seen differently: urgent is an open question until it is resolved, not when it is dismissed.

Evidence: urgent V6, combined V2.

Could steer: Mandate, approvals, the score (F).

## The signal is the control (`the-signal-is-the-control`)

The light or sound that calls you is the thing you press to stop it, so attention and action are in one place.

Evidence: urgent V1, combined V2.

Could steer: Diegetic (G), radial menu.

## Earned sound (`earned-sound`)

Every sound has a daily and hourly budget, and a learning sound retires once you have shown you know it. A silence ledger says why each event stayed quiet.

Evidence: pointer V6, ambient V4, combined V1.

Could steer: Notification rate budgets in the control room run (E).

## Hear the reach (`hear-the-reach`)

Before you publish or share, you sense how far it goes: the target floor as pitch or colour, the audience size as thickness. One grammar for publish, share and notify.

Evidence: pointer V4 and V5, floors V3, combined V3.

Could steer: Approvals, Artifacts publish, privacy.

## Turn-taking (`turn-taking`)

AUGUR's signals never talk over a screen reader or each other: it controls the order or steps aside.

Evidence: telemetry V5, grammar notes.

Could steer: Accessibility rules for every channel.

## Feel as a setting (`feel-as-a-setting`)

Tactile and audio feedback is a personal profile (none, quiet hand, detents), a token set swapped like a colour theme.

Evidence: pointer V1, V3, V6, combined V4.

Could steer: Account area; kit theming.

## Concepts this run moved forward

- `periphery-channel`: explored. Ambient sound fails the office test; the periphery is better served by answering on demand (`answer-not-announce`).
- `dark-when-normal`: confirmed for sound. No beds, no ticks by default.
- `time-is-matter`: the past is silent too.
- `the-record-has-edges`: silence only means "normal" when start and end marks show the instrument listened (bracketed silence, telemetry V2).
