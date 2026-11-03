<!--
Sync Impact Report
- Version: template → 1.0.0 (first ratified version, drafted from the tech-stack decision and spec 001)
- Principles added: I–VI
- Sections added: Technology Constraints, Development Workflow, Governance
- Templates: plan-template.md "Constitution Check" reads its gates from this file; no template edits needed
- Follow-up: Luka to review and amend with /speckit-constitution if anything is wrong
-->

# Rošada – Battle of the Heroes Constitution

## Core Principles

### I. The Rulebook Is the Source of Truth

The game plays the Rošada board game rules as written in the current rulebook (`Basic Rules 2_5.docx` and its corrections file).
- Every rule the game enforces MUST be traceable to a rulebook section or to a decision recorded in a spec's *Resolved* table.
- When the rulebook is unclear or contradicts itself, the question MUST be logged in the spec's *Open Questions* and decided by the rules designer before that rule is built. The decision is then written back into the rulebook.
- The game MUST NOT invent rules to fill gaps.

### II. Engine-Free Rules Core

Game rules, turn logic, hero abilities and the Destiny economy live in plain TypeScript modules.
- These modules MUST NOT import Three.js, Rapier, Colyseus or any browser/DOM API.
- They MUST run headless (Node.js) so they can be tested and later reused by an online server or a different engine.
- The game state MUST be a serialisable snapshot; rendering reads the state and sends player intents, it never changes rules state directly.

### III. Data-Driven Content

Components are data, not code.
- Units, heroes, health bars, tokens, board regions and later abilities MUST be defined in JSON (or typed data files) that the rules core loads.
- Adding a named hero MUST NOT require changes to the core rules modules beyond implementing that hero's ability effects.

### IV. Rules Are Tested First (NON-NEGOTIABLE)

- Every acceptance scenario in a spec MUST have an automated test against the headless rules core.
- A rules bug fix MUST start with a failing test that reproduces it.
- Tests MUST use a seeded random source so d20 results are repeatable.

### V. Verifiable Without a Human at the Keyboard

- The game MUST build and run from the command line and in a headless browser, so Claude can run it, take screenshots and check behaviour without someone pressing Play.
- Each feature's quickstart MUST describe how to run the tests and the game locally.

### VI. Keep It Simple

- Build what the current spec asks for. Future items (P2) are allowed only as seams in the design, not as code.
- Prefer fewer dependencies; any new runtime dependency MUST be justified in the plan.

## Technology Constraints

| Part | Choice |
| --- | --- |
| Language | TypeScript, runs in the browser |
| 3D table and rendering | Three.js |
| Physics (sandbox handling, dice) | Rapier (WebAssembly) |
| Multiplayer | Hot-seat first; online rooms later with Colyseus (Node.js) |
| Hosting | Static website; Node.js server for multiplayer later (can run on Azure) |

- Target browsers: current desktop Chrome, Edge and Firefox.
- The sandbox core (table, camera, physics, dice, save/load) stays separate from the Rošada game module.
- The engine choice may be revisited (Godot or Unity remain options). Principles II and III exist to keep that switch cheap.

## Development Workflow

- Spec-first with GitHub Spec Kit: `/speckit-specify` → `/speckit-clarify` (optional) → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
- One folder per feature under `specs/NNN-name/`, on its own git branch.
- A plan MUST pass the Constitution Check before research starts and again after design.
- UI text is kept in string files (English first, Croatian later).

## Governance

- This constitution overrides other practices in the repository. Plans and reviews MUST check compliance with it.
- Amendments are made with `/speckit-constitution`, recorded in the Sync Impact Report, and versioned: MAJOR for removed or redefined principles, MINOR for new principles or sections, PATCH for wording.
- Complexity that breaks a principle MUST be justified in the plan's *Complexity Tracking* table.

**Version**: 1.0.0 | **Ratified**: 2026-11-03 | **Last Amended**: 2026-11-03
