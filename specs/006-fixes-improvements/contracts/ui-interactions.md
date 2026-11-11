# Contract: Interface and Table Interactions

**Feature**: `006-fixes-improvements`

What the player can do and what the screen must show, in a form the browser tests check. Test ids are `data-testid` values; existing ids keep their names unless listed under "Removed".

## Board clicks

| Situation | Click | Result |
| --- | --- | --- |
| Move phase, no plan | A reachable square | Plan = shortest path to it; path and "Movement left" shown |
| Move phase, plan shown | A square reachable from the plan's end | Plan grows to it |
| Move phase, plan shown | The plan's last square | The hero walks the plan |
| Move phase, plan shown | Any other square, or Esc | Plan cleared |
| Move phase | Double click on a reachable square | Plan, then walk (the two clicks above) |
| Ability target prompt | A highlighted square, unit or hero | That target is chosen; the next step's picks are highlighted, or the ability is used |
| Ability target prompt | A blocked target (refused for a rule reason, such as "would place a King in check") | Hover: `board-tooltip` with the reason. Click: the same text; not chosen |
| Ability target prompt | Anything else | Nothing; the prompt stays. Esc or Cancel ends it without using the ability |
| Lead phase | As in 001 (unit, then square) | Unchanged |
| Lead phase, or the unit-and-square step of an "Instead of Lead" ability | A blocked square (the unit could go there but for check on the own King) | Hover: a tooltip at the pointer (`board-tooltip`) with "That would place your King in check". Click: the same text; no Lead is announced |

While a walk, a roll or a dialog is running, board clicks do nothing.

A square that can be passed but not ended on (`canEnd: false`) is drawn lighter. A plan may pass it or stop on it; while the hero stands there, End phase stays disabled as today and the help line says why.

## Keys

| Key | When | Result |
| --- | --- | --- |
| Space | End phase is enabled; this seat's move; no dialog, Settings or tracker open; no walk or roll running; focus not in a field; key not held | Ends the phase. A shown plan is dropped first |
| Esc | Plan shown or target prompt open | Clears it |
| Esc | Tracker open | Closes it (unchanged) |
| A | In a game | Opens / closes the Royal Favor menu (unchanged) |

## Panels and test ids

| Element | Test id | Contract |
| --- | --- | --- |
| Ability panel | `ability-panel` | Docked right, between the pools and the log. `data-collapsed="true|false"`. Header `ability-panel-toggle` shows the hero or form name and "n usable". `ability-panel-phase`: a small light green box in the header with the current phase's name, visible also when collapsed |
| Ability row | `ability-<id>` | Cost and uses together where both exist ("1 D · 1 of 1 left"). `ability-<id>-status` holds the reason when not usable, including "would place a King in check"; it is shown as a tooltip on hover and keyboard focus of the row |
| Use button | `use-<id>` | Unchanged. *Preaching* with both uses available: `use-monk.preaching-one` and `use-monk.preaching-both`, each with its effect and cost in the label |
| Target prompt help | `target-help` | Ability name, what to click, `target-cancel` button |
| Move help | `help` | "Movement left: n" for the plan; why the Move cannot end on the current square |
| Lead panel | `lead-panel`, `lead-preview` | With a roll: "d20 + … ≥ 6" with names. Without: `lead-auto` with the reason text. Never "No roll needed" |
| Inspired Lead at the roll | `inspired-lead-roll` | Next to `roll-button` while the roll is awaited and Inspired Lead is legal |
| Inspired Lead in Before Lead | `inspired-lead` | Unchanged, only in Before Lead |
| Hero card | `hero-<id>` | Name line with the hero or form name; `hero-<id>-move`, `hero-<id>-range` badges; `hero-<id>-health` is the bar, `aria-label` "Health 6 of 8", text "6/8"; `hero-<id>-unit-icons` with `data-unlocked` |
| Top bar | `active-hero` | "H1 · Cavalier (Light)"; `active-movement`, `active-range` badges |
| Flash | `flash` | `data-kind`, `data-tone`. A skipped phase: `data-kind="skipped"`, text "Phase 'Before Lead' skipped", one per phase; Before Turn, Beginning of Turn and Before Move only for a hero with an ability timed there |
| "CHECK" notice | `check-flash` | `data-side` = the checked King's side. On every `check` event it appears above that King on the board, blinks three times, one second each, then is gone. It stays on the King if the camera moves, and does not take clicks. Shown to all players. A new check on the same King restarts it. The log gets its own line. Reduced motion: steady for three seconds |
| Own-King warning | `own-check-warning` | Opens before a non-Lead action is sent when `wouldCheckOwnKing` is true: "This will put your King in check". Buttons `own-check-continue` (the action is sent) and `own-check-undo` (nothing is sent; chosen targets are dropped). Esc = Undo |
| "In check" pop-up | `in-check-<side>` | Directly above `ability-panel` (also when collapsed), in the side's colour, text "Light: in check". Present exactly while that King is in check. Focusable; on hover or focus `in-check-rule` shows: "If your King is in check at the end of your Lead, you cannot use After Lead nor End of Turn abilities that turn." Two pop-ups when both Kings are in check |
| Settings | `settings` | Buttons in order: sandbox toggle, Save, Export, Import, New game, `offer-draw`, `settings-resume`. Online: Download, `offer-draw`, Leave, `settings-resume` |
| Destiny dialog | `dialog` | `destiny-hero` (name), `destiny-step` ("2 of 4"; in Mirror "1 of 2"), cards `destiny-<destiny>` with `destiny-<destiny>-form` (form name) and an `img` whose `src` is that form's portrait; `destiny-chosen` list. Mirror: `destiny-applies` names both heroes the choice is for |
| Checkmate alert | `checkmate-alert` | Shown instead of turning rules on when `positionWarnings` has a checkmate (Settings "Turn rules back on" and the position editor's start). Names the checkmated side(s) and what continuing means. Buttons `checkmate-continue` (rules come back on) and `checkmate-back` (stay in sandbox, nothing changed). Esc = back. A position with problems shows the 001 problem list first, not this alert |
| Hero pick card | `pick-<heroId>` | First click: `data-pending="true"` and `pick-confirm-hint`. Second click on it: the pick. In Mirror, Dark's pick has no card for the hero Light already picked (FR-013) |
| Royal Favor menu | `tracker` | `tracker-shared` row with 11 slots, `data-light`, `data-dark` counts; the lists `tracker-light`, `tracker-dark` unchanged |

**Removed**: `settings-close` (now `settings-resume`); `offer-draw` in the action bar (same id, now in Settings); `tracker-<side>` slot rows of 16.

## Table

| Element | Contract |
| --- | --- |
| Shared track | One mesh, `userData.kind = 'track'`, vertical, between the board and the strip. `tableElements().track` = `{ slots: 11, light, dark }` |
| Per-side tracks | Gone. `tableElements().tracks` is removed |
| Strip, Graveyard zones, Well | Moved outwards; all four strip corners inside the viewport at the default camera from both sides at 1366×768 |
| Table | `tableElements().ttsTable` is true once the model is shown; the slab is shown before that and with `?placeholders` |
| Units | With TTS models: turned by the model's `yaw`. `maxPieceTilt()` stays ~0 in rules mode |
| Highlights | `highlighted()` returns kinds `move` (can end), `pass` (cannot end), `path` (planned), `range`, `target`, `blocked` (a Lead only check forbids), plus the existing `lead`, `battle`, `decision`, `place` |
| Camera | Online: default side = the local seat's side on every turn. Hot-seat: the active side. Reset camera returns to that side |

## Test hook (`window.__rosada`, dev and e2e builds) — added

```ts
plan(): { path: string[]; left: number } | null;        // planned Move path as square names
flashes(): { kind: string; text: string; tone: string }[]; // every flash shown so far
panelRects(): Record<string, { x: number; y: number; w: number; h: number }>; // HUD panels on screen
boardRect(): { x: number; y: number }[];                  // the board's four corners on screen
viewSide(): 'light' | 'dark';
```

In e2e builds a walk has no delay between steps and flashes have no animation time, so tests read results at once.

## Layout rule (SC-004)

At 1920×1080 and 1366×768, with the default camera from either side: no rectangle of `panelRects()` contains a point inside the polygon of `boardRect()`. The ability panel may start collapsed below 1500 px width to keep this.
