---
name: shell-owns-loudness
status: explored
---

# The shell owns loudness

Apps raise a notice at a level; only the shell decides whether and how loudly it reaches a person (light, sound, toast), under one budget. Extends ADR 0044's levels from visual loudness to every channel.

First found in: [`2026-11-03-room-tone`](../runs/2026-11-03-room-tone/) (grammar V1, combined V1 and V4).

Could steer: Notifications contract; control room (E).

Explored in [`2026-11-03-the-switchboard`](../runs/2026-11-03-the-switchboard/): the four classes (urgent, needs you, tell me, for the record) are the shell's loudness table; an app sets only the level and the address.
