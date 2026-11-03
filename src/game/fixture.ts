// Export a position as a test fixture (tests/fixtures/position.ts format) for playtest discussion (FR-204).
import { squareName, type GameState, type UnitType } from '../rules/index.ts';

const LETTER: Record<UnitType, string> = { king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p' };

export function toFixture(s: GameState): string {
  const grid = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => '.'));
  for (const u of s.units) {
    const ch = LETTER[u.type];
    grid[9 - u.pos.y][u.pos.x] = u.side === 'light' ? ch.toUpperCase() : ch;
  }
  const heroes: Record<string, string> = {};
  for (const h of s.heroes) {
    if (grid[9 - h.pos.y][h.pos.x] === '.') grid[9 - h.pos.y][h.pos.x] = h.id.slice(1);
    else heroes[h.id] = squareName(h.pos).replace('T-', '');
  }
  const opts = {
    ...(Object.keys(heroes).length ? { heroes } : {}),
    ranges: Object.fromEntries(s.heroes.map((h) => [h.id, h.rangeType])),
    health: Object.fromEntries(s.heroes.map((h) => [h.id, h.health])),
    pools: Object.fromEntries(s.heroes.map((h) => [h.id, h.pool])),
    common: s.destiny.common,
    peaceTreaty: s.tokens.peaceTreaty,
    revenge: s.tokens.revenge,
    wellRemaining: s.destiny.well.initialRemaining,
    active: s.activeHeroId,
  };
  const diagram = grid.map((r) => `  ${r.join('')}`).join('\n');
  return `position(\`\n${diagram}\`, ${JSON.stringify(opts, null, 2)});\n`;
}
