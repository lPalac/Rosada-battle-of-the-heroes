# Quickstart: Fixes and Improvements from the First Playtests

**Feature**: `006-fixes-improvements`

How to run, test and check this feature once it is built. Setup is as in 001 ([001 quickstart](../001-standard-rules-game/quickstart.md)): Node.js 24 LTS, `npm install`, `npx playwright install chromium`. Commands are run from the repository root.

## Run

```powershell
npm run dev          # the game on http://localhost:5173
npm run dev:server   # only for the online checks (B-07 online, B-13)
```

Useful URL switches (unchanged): `?generic` also offers the generic heroes, `?placeholders` turns off the TTS models.

## Tests

```powershell
npm test             # type checks, data schemas, Vitest
npm run test:e2e     # Playwright
```

Single areas while working:

```powershell
npx vitest run tests/rules/destiny-check.test.ts      # B-05: new checks, once per turn, any kind of action
npx vitest run tests/rules/own-king.test.ts           # B-05: refused Leads, Instead of Lead abilities, wouldCheckOwnKing
npx vitest run tests/rules/ability-check.test.ts      # FR-016: direct check refused, discovered check allowed, blocked targets
npx vitest run tests/rules/both-uses.test.ts          # FR-017: Preaching one use or both
npx vitest run tests/rules/starting-cost.test.ts      # B-09
npx vitest run tests/rules/move-path-abilities.test.ts # B-10, B-11
npx vitest run tests/rules/sandbox-resume.test.ts     # B-06
npx vitest run tests/rules/position-warnings.test.ts  # B-06: checkmate alert
npx vitest run tests/rules/epic-mirror.test.ts        # B-01: Mirror destinies
npx vitest run tests/rules/setup.test.ts              # B-01: Mirror picks, no hero twice on a side
npx vitest run tests/rules/inspired-lead.test.ts      # B-07
npx vitest run tests/rules/move-reach.test.ts         # B-16
npx vitest run tests/game                             # models: labels, move plan, targets, flashes, destiny, favors, HUD
npx playwright test tests/e2e/fixes-*.spec.ts         # US3–US7 in the browser
```

Expected: everything green, including the 001–005 suites. Tests are named `US<n>-AS<m>` after the scenarios in [spec.md](./spec.md).

## Manual check (20 minutes, hot-seat unless noted)

Start a Draft game with Cavalier, Monk, Scout, Magus. For positions that are slow to reach, use Settings → Turn rules off, set the position, and turn rules back on (this is also the B-06 check).

| # | Item | Do | Expect |
| --- | --- | --- | --- |
| 1 | B-12 | In setup, click a hero once, then another, then the second one again | First clicks only highlight with "Click again to confirm"; the last click picks |
| 2 | B-20, B-21, B-18 | Look at the hero cards and the top bar | Names (*Cavalier*), Move and Range badges, a green health bar with numbers, a dimmed Hero Unit icon. No "Short range" |
| 3 | B-16 | On the Cavalier's Move: click a square 3 away, then one more, then the last one again | All reachable squares are lit; the path is drawn; "Movement left" drops; the hero walks; Undo takes back one step at a time |
| 4 | B-16 | Double-click a reachable square | The hero walks there by the shortest path |
| 5 | B-15 | Press Space | The phase ends. Hold Space: it ends only once |
| 6a | Q-62a | With the Monk, both *Preaching* uses left and 2 D: press Use | A choice: one use (−4 to Lead, 1 D) or both (cannot be Led, 2 D). With 1 D only the single use is offered |
| 6 | B-09 | Use *Demoralise* in Before Move | The Hero Pool drops by 1; the row reads "1 D · 0 of 1 left"; the sheet shows a crystal on the symbol |
| 7 | B-04 | Lead a unit while the Peace Treaty is up | The panel says why the Lead succeeds; "No roll needed" appears nowhere |
| 8 | B-07, X-01 | After War is declared, with the Magus use *Future Sight*, end Before Lead, announce a Lead | "d20 + War +2 + Future Sight +2 ≥ 6" with names; an Inspired Lead button next to Roll d20; spending 1 D adds +2 to the line |
| 9 | B-02 | After a successful Lead with the Cavalier, press Use on *Warhorse* | Squares light up on the board; no list of coordinates; a click moves the hero; Esc cancels |
| 10 | B-03 | In After Lead press End phase, then Undo | Back in After Lead with *Warhorse* usable |
| 11 | B-19 | Wound a hero with *Flaming Bolt*; gain Destiny by a Battle; end a phase so the next one passes by itself | Flashes for the ability, the wounds and the Destiny (with its reason) appear for half a second and slide to the log. Each phase the game passes by itself shows "Phase '<name>' skipped"; at the start of a turn only for phases in which the hero has an ability (the Dragon Lord shows none of the three) |
| 12 | B-05 | With the Magus: give check by a Lead, then in After Lead use *Souls Clash* so the Queen's file opens onto the King | "CHECK" appears above the checked King and blinks three times, one second each, at each of the two checks. One "+2 D check" for the turn; the *Souls Clash* gain reads "+2 D destroyed an enemy unit". An "In check" pop-up for the checked side sits above the ability panel; hovering it shows the rule about the end of the Lead |
| 12a | B-05 | Leave the King in check; on your side's next turn Lead a unit that has nothing to do with the check. Then Lead a second unit so it checks too | Nothing for the first Lead; "CHECK" and +2 D for the second |
| 12b | B-05 | Promote a Pawn to a Queen that checks the King; in another game, make a check with an ability only | +2 D and "CHECK" in both |
| 12c | B-05 | Get the checked King out of check | The "In check" pop-up goes away |
| 12d | B-05 | Select a unit that shields your King from an enemy Rook or Bishop and hover a square off that line, then click it. Try the same with an "Instead of Lead" ability (*Tight Formation* with a pinned Knight) | The square is marked as blocked; hovering it shows "That would place your King in check", and so does the click; no Lead is made |
| 12f | B-05 | Try a push (*Terrifying Roar*, *Bushwack*) that would move a unit onto a square from which it checks a King. Then one that moves a unit off the line between a Rook and a King | First: the target is shown as blocked and hovering it says "That would place a King in check". Second: allowed (a discovered check); if it is your own King, the Continue / Undo warning comes first |
| 12e | B-05 | Use *Souls Clash* on your own Pawn that shields your King | Before anything happens: "This will put your King in check" with Continue and Undo. Undo: nothing used, nothing paid. Continue: "CHECK" above your King, and the other side gains 2 D (if it had none from check this turn) |
| 13 | B-06 | In the Lead phase before Leading: Settings → Turn rules off, then Turn rules back on | Same hero, Lead phase, same Movement left. Repeat after the roll: still After Lead, no second Lead |
| 13a | B-06 | In sandbox, set up a checkmate, then Turn rules back on | An alert names the checkmated side. "Back to sandbox" changes nothing. "Continue the game" turns rules on; the game ends by checkmate when the next turn begins |
| 13b | B-06 | With your own King in check, go to sandbox and back in the Lead phase, then make a Lead that fails (roll until one does; the e2e build has `window.__rosada.forceNextRoll(1)`) | No After Lead or End of Turn abilities are offered and the turn ends, as it does without the sandbox trip |
| 14 | B-08, B-22 | Open Settings | "Offer draw" and "Resume game" are there; the action bar has no Offer draw |
| 15 | B-17 | Click the ability panel's header | It collapses to one line with "n usable" and the light green phase box, and opens again; the board is not covered either way; a reload keeps the choice |
| 16 | B-14 | Complete a Royal Favor (sandbox: set favors for both sides) | One vertical track between the board and the Graveyard with a gold and a purple marker; the Graveyard is fully in view; `A` opens the menu with the same shared row and both lists |
| 17 | B-24, B-23 | Look at the table | Units face the enemy; the TTS table with legs is under the board; `?placeholders` shows the slab |
| 18 | B-01 | Empty the Well (sandbox: set the Well to 1, then gain Destiny) and start the next turn | Four choices in turn order, each with the hero's name, "choice n of 4", its three forms by name and portrait, and the list of choices so far |
| 18a | B-01 | The same in a Mirror game (in setup, try to pick Light's hero again for Dark) | In setup, Light's hero is not offered for Dark's pick. Two choices. The first names both heroes of one class and gives both the chosen form; then the other side chooses for the other class. Both sides end with the same two forms |
| 19 | B-10, B-11 | As the Dragon Lord, walk through an enemy hero's square and two squares on; as the Saint, the same through a friendly hero. Also start a Move on such a hero's square | *Breath* and *Saintly Inspiration* are usable until the Move ends. On a square with the wrong kind of hero the row says what it needs |
| 20 | B-13 | Online, two windows (`npm run dev:server`), one seat per side | Each window keeps its own side's view on every turn; orbiting is not undone; Reset camera returns to the own side |

## Screenshots for review

```powershell
npx playwright test tests/e2e/fixes-hud.spec.ts tests/e2e/fixes-table.spec.ts --update-snapshots
```

The specs save the HUD and the table at 1920×1080 and 1366×768 from both sides. Check them against the sheet's screenshots in `screenshots/`.

## After merging

Redeploy the Render test site (005 quickstart: Manual Deploy → Deploy latest commit) and run `npx tsx scripts/smoke.ts https://rosada.onrender.com`. Client and server must come from the same commit, because the rules data changed.
