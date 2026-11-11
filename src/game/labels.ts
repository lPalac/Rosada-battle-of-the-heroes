// 006 X-01, X-02 (FR-032): names for Lead modifier sources, Destiny and heal reasons and effect marks. Abilities use
// their ids as sources and reasons, which have no `mod.` / `reason.` string; they are shown by the ability's name.
// A text key is never shown.
import { hasString, t } from '../i18n/strings.ts';

/** The ability's name when `id` is an ability id, else null. */
export function abilityNameOf(id: string): string | null {
  return hasString(`ability.${id}.name`) ? t(`ability.${id}.name`) : null;
}

const signed = (n: number): string => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);

/** "War +2", "Future Sight +2", "Bear Traps −3". */
export function modifierLabel(source: string, value: number): string {
  if (hasString(`mod.${source}`)) return t(`mod.${source}`, { n: value });
  const name = abilityNameOf(source) ?? (hasString(`effect.${source}`) ? t(`effect.${source}`) : null);
  return t('mod.named', { name: name ?? t('mod.other'), n: signed(value) });
}

/** "check", "destroyed an enemy unit", "Rejuvenating Stroll". */
export function reasonLabel(reason: string): string {
  if (hasString(`reason.${reason}`)) return t(`reason.${reason}`);
  return abilityNameOf(reason) ?? (hasString(`effect.${reason}`) ? t(`effect.${reason}`) : t('reason.other'));
}

/** "Bear Trap", "Preaching", or "Mark". */
export function markLabel(kind: string): string {
  if (hasString(`effect.${kind}`)) return t(`effect.${kind}`);
  return abilityNameOf(kind) ?? t('effect.mark');
}
