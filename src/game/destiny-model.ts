// 006 US3 (FR-010, FR-011, FR-012, research R-01, R-17): what the Epic destiny dialog shows. Engine-free.
// Named heroes: the hero's own three forms by name and portrait (heroes.json). The generic test heroes keep what the
// dialog showed before 006: the destiny name on the hero definition's `epicArt` picture.
import { DATA, EPIC_DESTINIES, type EpicDestiny, type GameState, type HeroId, type Side } from '../rules/index.ts';

export interface DestinyCard {
  destiny: EpicDestiny;
  /** The Epic form's name (*Death Knight*), or null for the generic test heroes. */
  formName: string | null;
  /** A form portrait key (`portrait.deathKnight`), or for the generic heroes their `epicArt` key (one column each). */
  portraitKey: string;
  /** True when `portraitKey` is a three-column Epic art image (generic heroes). */
  columns: boolean;
  allowed: boolean;
  /** The ally's destiny that blocks this card (Fanatic blocks Dominant and back), or null. */
  blockedBy: EpicDestiny | null;
}

export interface DestinyChoiceModel {
  heroId: HeroId;
  heroName: string;
  /** True for a named hero (Cavalier …); false for the generic test heroes. */
  named: boolean;
  side: Side;
  playerId: string;
  /** The heroes that take the chosen destiny: the chooser, and in a Mirror game its twin on the other side. */
  appliesTo: { heroId: HeroId; side: Side; heroName: string }[];
  step: number;
  of: number;
  cards: DestinyCard[];
  chosen: { heroId: HeroId; heroName: string; formName: string | null; destiny: EpicDestiny }[];
}

const defOf = (definitionId: string) => DATA.heroes.find((d) => d.id === definitionId)!;

export function destinyChoiceModel(state: GameState): DestinyChoiceModel | null {
  const d = state.pendingDecision;
  if (!d || d.type !== 'epicDestiny') return null;
  const h = state.heroes.find((x) => x.id === d.heroId)!;
  const def = defOf(h.definitionId);
  const named = !!def.forms;
  const nameOf = (id: HeroId) => defOf(state.heroes.find((x) => x.id === id)!.definitionId).name;
  const ally = state.heroes.find((x) => x.side === h.side && x.id !== h.id)?.epic?.destiny ?? null;
  const cards: DestinyCard[] = EPIC_DESTINIES.map((destiny) => {
    const form = def.forms?.[destiny];
    const allowed = d.options.includes(destiny);
    return {
      destiny, formName: form?.name ?? null, portraitKey: form?.portrait ?? def.epicArt, columns: !form, allowed,
      blockedBy: allowed ? null : ally,
    };
  });
  const open = [state.pendingDecision, ...state.decisionQueue].filter((x) => x?.type === 'epicDestiny').length;
  const done = state.heroes.filter((x) => x.epic).length;
  // Each decision covers `appliesTo` heroes (1 in Draft, 2 in Mirror); the total is the decisions made plus the open ones.
  const per = Math.max(1, d.appliesTo.length);
  const made = Math.round(done / per);
  const chosen = state.heroes
    .filter((x) => x.epic)
    .map((x) => {
      const xd = defOf(x.definitionId);
      return { heroId: x.id, heroName: xd.name, formName: xd.forms?.[x.epic!.destiny]?.name ?? null, destiny: x.epic!.destiny };
    });
  return {
    heroId: h.id, heroName: def.name, named, side: h.side, playerId: h.playerId,
    appliesTo: d.appliesTo.map((id) => ({ heroId: id, side: state.heroes.find((x) => x.id === id)!.side, heroName: nameOf(id) })),
    step: made + 1, of: made + open, cards, chosen,
  };
}
