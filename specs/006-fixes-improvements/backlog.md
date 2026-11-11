# Backlog: Fixes & Improvements

**Feature**: `006-fixes-improvements` | **Source**: `Fixes & Improvements.xlsx` (Vice, 2026-11-10), 24 rows, 10 screenshots

The spreadsheet as written, one row per item. `B-nn` is the row number in the sheet and is the id used in [spec.md](./spec.md), [plan.md](./plan.md) and [research.md](./research.md). Priority is the sheet's own scale: 1 is most urgent, 5 least.

| Id | Priority | Problem | Idea | Solution asked for | Screenshot |
| --- | --- | --- | --- | --- | --- |
| B-01 | 1 | Epic phase: choosing heroes doesn't work well | | "Fix it, there is something weird with the choosing, as if the pics don't change or something. Check and see if you find something. Cross reference with rules and if you can't find anything ask" | |
| B-02 | 3 | Cavalier Warhorse ability prompts coordinates | | Warhorse needs to highlight squares on the battlefield instead | [B-02](./screenshots/B-02-warhorse-coordinates.jpg) |
| B-03 | 1 | "I think undo only reverts back to the start of the phase, not before that" | | Make undo work between phases, if it doesn't now. Screenshot note: "need back button. Clicked end phase after lead and skipped after lead phase" | [B-03](./screenshots/B-03-undo-after-end-phase.jpg) |
| B-04 | 5 | Says "No roll needed" | | Change it to something that doesn't say "no roll needed", because it's ugly | [B-04](./screenshots/B-04-no-roll-needed.jpg) |
| B-05 | 2 | Multiple units checking the King each give Destiny | | Gain Destiny for checking only once per turn, regardless of how many units check the King. Screenshot note: "gave destiny for both checks" | [B-05](./screenshots/B-05-check-destiny.jpg) |
| B-06 | 3 | Exiting to sandbox and coming back resets the player's turn to the beginning (unknown whether this occurs if the die has been rolled) | | When entering sandbox during an active game, remember the phase it was in. When entering the rules game from sandbox, return to that phase | |
| B-07 | 4 | Inspired Lead button missing from the prompt on the die roll | | At the Lead phase, when you roll the die, there should be a button to use Inspired Lead. Even though it technically is used in the Before Lead phase, it should show next to the roll button for ease of use and as a subtle reminder | [B-07](./screenshots/B-07-inspired-lead-at-roll.jpg) |
| B-08 | 5 | Resume game button is called "Close" | | Rename the "Close" button to "Resume" | [B-08](./screenshots/B-08-settings-close.jpg) |
| B-09 | 2 | Starting hero abilities don't spend Destiny | | Make starting abilities (phase 1) spend Destiny according to the rules. Screenshot note: "not using destiny for 1 phase abilities" | [B-09](./screenshots/B-09-starting-abilities-destiny.jpg) |
| B-10 | 2 | Breath of Fiery Destruction doesn't work in the Move phase (potentially in the Lead phase too?) | | Use should show up when in the square of an enemy hero. This could be easier when B-16 is implemented | [B-10](./screenshots/B-10-breath-move-phase.jpg) |
| B-11 | 4 | Similar to B-10 (the screenshot shows Saintly Inspiration) | | Needs to be clickable during the Move phase | [B-11](./screenshots/B-11-saintly-inspiration-move-phase.jpg) |
| B-12 | 5 | Hero selection at game start has no "confirm": it picks at once, so a misclick ruins the pick | | After the first click, highlight the hero and show "click again to confirm"; a second click on the same hero chooses it | |
| B-13 | 4 | Multiplayer: the camera view is not the player's view when it is not the player's turn | | The camera should stay on the player's side on other players' turns. They can still move the camera, but the default is their colour's side | |
| B-14 | 4 | Royal Favor problems | | Only one list of granted favors is needed on the board. Keep the menu of granted favors as is. The Royal Favor tracker should go from 1 to 11 and show Light and Dark on the same tracker, so players see which side has how many favors. Place the tracker vertically between the board and the Graveyard, and shift the Graveyard so it stays fully visible. "Ask if you need more clarification" | [B-14](./screenshots/B-14-royal-favors-tracker.jpg) |
| B-15 | 5 | | End phase should also be triggered with Space on the keyboard | | |
| B-16 | 5 | | Hero movement: instead of marking only the next step, mark everything the hero can reach (translated from Croatian) | A double click on a square moves you there at once by the shortest path. Click by click marks a path until you double-click the final square. As you move, your available Movement goes down. While you select the path, the available Movement goes down visually (the legally reachable squares) (translated from Croatian) | |
| B-17 | 5 | Abilities screen covers the board | | Move hero abilities to the side and make them collapsible, so the user can see the board clearly | |
| B-18 | 4 | | Health bar | Show a green health bar instead of just numbers. As health goes down, that part of the bar turns from green to red. Keep the numbers in the bar, with enough contrast to read them | |
| B-19 | 4 | | Low visibility of resolved effects | Add flash animations when health is lost or healed, damage dealt, dice rolled, ability activated, phases skipped, Destiny gained. Each one shows for 0.5 s, then slides towards the log and fades away | |
| B-20 | 3 | Remove the descriptors of heroes as Short and Long range | | Make the Movement and Range of heroes more visible | |
| B-21 | 5 | The type of Hero Unit a hero becomes with 6 favors should be more visible, shown as small icons next to the hero's Epic class | | | |
| B-22 | 5 | Move the Offer draw button into Settings | | | |
| B-23 | 5 | | Use the table in `D:\01 Projects\Rosada_Video-game` | "Ask if unsure" | |
| B-24 | 5 | Turn units on the board by 180 degrees, because they are facing the wrong way | | | |

## Also seen in the screenshots (not rows in the sheet)

| Id | Seen in | What |
| --- | --- | --- |
| X-01 | B-07 screenshot | The roll line shows raw text keys: `d20 + War +2 + mod.scout.bearTraps + mod.magus.futureSight ≥ 6`. The hero sheet tags show `nextLeadBonus` and `demoralise` the same way |
| X-02 | B-14 screenshot (log behind the tracker) | The log shows a raw reason key for an ability heal (`reason.magus.souls…`) |
