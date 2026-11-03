// Turns log entries into readable lines (FR-112). Text comes from the string file (A-02).
import { t } from '../i18n/strings.ts';
import { squareName, type Coord, type LogEntry } from '../rules/index.ts';

const sq = (c: unknown): string => squareName(c as Coord);

/** One line per entry, or null for bookkeeping entries the log hides. */
export function formatLogEntry(e: LogEntry): string | null {
  const d = e.data as Record<string, any>;
  switch (e.type) {
    case 'turnStarted': return t('log.turnStarted', { n: d.turnNumber, hero: d.heroId });
    case 'turnSkipped': return t('log.turnSkipped', { hero: d.heroId });
    case 'heroMoved': return t(`log.heroMoved.${d.reason}`, { hero: d.heroId, from: sq(d.from), to: sq(d.to) });
    case 'leadAnnounced': return t('log.leadAnnounced', { unit: d.unitId, from: sq(d.from), to: sq(d.to) });
    case 'rolled':
      return d.total === null
        ? t('log.freeRoll', { value: d.value })
        : t(d.success ? 'log.rollSuccess' : 'log.rollFail', { value: d.value, total: d.total });
    case 'leadFailed': return t('log.leadFailed', { unit: d.unitId });
    case 'unitLed': return t('log.unitLed', { unit: d.unitId, to: sq(d.to) });
    case 'unitDestroyed': return t('log.unitDestroyed', { unit: d.unitId });
    case 'heroRammed': return t('log.heroRammed', { hero: d.heroId, unit: d.byUnitId, to: sq(d.landing) });
    case 'heroPushed': return t('log.heroPushed', { hero: d.heroId, to: sq(d.landing) });
    case 'heroWounded': return t('log.heroWounded', { hero: d.heroId, n: d.amount, health: d.health });
    case 'heroHealed': return t('log.heroHealed', { hero: d.heroId, n: d.amount, health: d.health, reason: t(`reason.${d.reason}`) });
    case 'heroUnconscious': return t('log.heroUnconscious', { hero: d.heroId });
    case 'heroRecovered': return t('log.heroRecovered', { hero: d.heroId });
    case 'destinyChanged':
      return t(d.delta > 0 ? 'log.destinyGain' : 'log.destinySpend', {
        n: Math.abs(d.delta),
        pool: d.pool === 'hero' ? d.heroId : t(`side.${d.side}`),
        reason: t(`reason.${d.reason}`),
      });
    case 'wellDepleted': return t('log.wellDepleted');
    case 'tokenChanged':
      return d.token === 'peaceTreaty' ? t('log.war') : t('log.revenge', { side: t(`side.${d.side}`), n: d.value });
    case 'promoted': return t('log.promoted', { unit: d.unitId, to: t(`unit.${d.to}`) });
    case 'check': return t('log.check', { side: t(`side.${d.side}`) });
    case 'abilityUsed': return t(`log.ability.${d.ability}`, { hero: d.heroId, n: d.destiny });
    case 'bought': return t(`log.bought.${d.item}`, { hero: d.heroId });
    case 'drawOffered': return t('log.drawOffered', { side: t(`side.${d.fromSide}`) });
    case 'drawDeclined': return t('log.drawDeclined', { side: t(`side.${d.bySide}`) });
    case 'gameEnded': return t('log.gameEnded');
    case 'enforcementChanged': return t(`log.enforcement.${d.mode}`);
    case 'sandboxEdited': return t('log.sandboxEdited', { what: d.what, target: d.target ?? '' });
    default: return null;
  }
}
