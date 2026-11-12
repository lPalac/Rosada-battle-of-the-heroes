// 006 US6 (FR-035, FR-039, research R-10): short notices built from the events of one action.
import { describe, expect, it } from 'vitest';
import { act } from '../helpers/game.ts';
import { board, sq, unitOn } from '../fixtures/position.ts';
import { flashesFor } from '../../src/game/flash-model.ts';
import type { GameEvent } from '../../src/rules/index.ts';
import { lead, unitT, use } from '../rules/heroes/helpers.ts';

const kinds = (fl: { kind: string }[]) => fl.map((f) => f.kind);
const texts = (fl: { text: string }[]) => fl.map((f) => f.text);

describe('US6 – flashes (B-19)', () => {
  it('US6-AS4 (model) a wound, an ability and a Destiny gain, each with its reason', () => {
    const s = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'magus' }, heroes: { H1: 'c4', H2: 'e5' }, phase: 'beforeMove' });
    const r = use(s, 'magus.flamingBolt', [{ heroId: 'H2' }]);
    const fl = flashesFor(r.events, r.state);
    expect(kinds(fl)).toContain('ability');
    expect(kinds(fl)).toContain('wound');
    expect(fl.find((f) => f.kind === 'wound')).toMatchObject({ tone: 'bad' });
    expect(texts(fl).some((t) => t.includes('Flaming Bolt'))).toBe(true);
    expect(fl.find((f) => f.kind === 'destiny' && f.text.includes('Flaming Bolt'))?.text).toMatch(/−1 D/);
  });

  it('US6-AS4 (model) Destiny is summed per pool and reason; the Epic split is left out', () => {
    let s = board({ c4: 'B', e2: 'Q', e4: 'P', e6: 'p', h1: 'K', e8: 'k', h7: 'p' }, { heroDefs: { H1: 'magus' }, heroes: { H1: 'd3' } });
    s = lead(s, 'c4', 'b5');
    const r = use(s, 'magus.soulsClash', [unitT(s, 'e4'), unitT(s, 'e6')]);
    const destiny = flashesFor(r.events, r.state).filter((f) => f.kind === 'destiny').map((f) => f.text);
    expect(destiny).toContain('+2 D Light: destroyed an enemy unit');
    expect(destiny.some((t) => t.includes('check'))).toBe(false); // already gained this turn
    expect(kinds(flashesFor(r.events, r.state))).toContain('check');
  });

  it('US6-AS11 (model) a check names the checked side', () => {
    const s = board({ a1: 'R', h1: 'K', e8: 'k' }, { heroes: { H1: 'b0' }, phase: 'lead' });
    const r = act(s, { type: 'announceLead', unitId: 'L-R@a1', to: sq('e1') });
    expect(flashesFor(r.events, r.state).find((f) => f.kind === 'check')).toMatchObject({ side: 'dark', text: 'CHECK' });
  });

  it('US6-AS4 (model) a roll shows its value, total and result', () => {
    let s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'c2' }, peaceTreaty: 'war', phase: 'lead' });
    s = act(s, { type: 'announceLead', unitId: unitOn(s, 'c3')!.id, to: sq('b5') }).state;
    const r = act(s, { type: 'submitRoll', value: 2 });
    expect(flashesFor(r.events, r.state).find((f) => f.kind === 'roll')).toMatchObject({ text: 'Roll 2, total 4: fail', tone: 'bad' });
  });

  it('US6-AS4 (model) each phase the game passes by itself is announced; the three start phases only for a hero with abilities there', () => {
    // A generic hero with no Destiny (no Inspired Lead): ending the Move passes Before Lead by itself.
    const s = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'c2' }, pools: { H1: 0 }, phase: 'move' });
    const r = act(s, { type: 'endPhase' });
    const skipped = flashesFor(r.events, r.state).filter((f) => f.kind === 'skipped').map((f) => f.text);
    expect(skipped).toEqual(["Phase 'Before Lead' skipped"]);
    // End of Turn of H1 passes; H2 (generic) starts: Before Turn, Beginning of Turn, Before Move are not announced.
    let e = board({ c3: 'N', h7: 'p' }, { heroes: { H1: 'c2' }, phase: 'lead' });
    e = act(e, { type: 'announceLead', unitId: unitOn(e, 'c3')!.id, to: sq('b5') }).state;
    if (e.pendingDecision?.type === 'advanceSquare') e = act(e, { type: 'decide', decision: { type: 'square', to: (e.pendingDecision as { options: { x: number; y: number }[] }).options[0] } }).state;
    const pass = act(e, { type: 'endPhase' });
    const names = flashesFor(pass.events, pass.state).filter((f) => f.kind === 'skipped').map((f) => f.text);
    expect(names.some((n) => /Before Turn|Beginning of Turn|Before Move/.test(n))).toBe(false);
  });

  it('US6-AS4 (model) a Cavalier whose Demoralise is spent sees "Phase \'Before Move\' skipped"; a Dragon Lord sees none of the three', () => {
    const start: GameEvent[] = (['beforeTurn', 'beginningOfTurn', 'beforeMove', 'move'] as const).map((phase) => ({ type: 'phaseChanged', heroId: 'H1', phase }));
    const cav = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier' }, heroes: { H1: 'c2' }, uses: { H1: { 'cavalier.demoralise': 0 } } });
    expect(flashesFor(start, cav).filter((f) => f.kind === 'skipped').map((f) => f.text)).toEqual(["Phase 'Before Move' skipped"]);
    const dragon = board({ c3: 'N', h7: 'p' }, { heroDefs: { H1: 'cavalier' }, stage: 'epic', epic: { H1: 'resolute' }, heroes: { H1: 'c2' } });
    expect(flashesFor(start, dragon).filter((f) => f.kind === 'skipped')).toEqual([]);
  });
});