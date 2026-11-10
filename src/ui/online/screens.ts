// 005 T034, T044: Play online (create / join), the lobby with seats, and the online status bar.
// Names always go in as text nodes (el children), never as markup (FR-063).
import { t } from '../../i18n/strings.ts';
import type { RoomView, SeatId, SeatView } from '../../online/model.ts';
import type { Side } from '../../rules/index.ts';
import { button, el } from '../dom.ts';

export interface PlayOnlineDraft {
  name: string;
  code: string;
  playerCount: 2 | 3 | 4;
  singleSide: Side;
  mode: 'draft' | 'mirror';
  error: string | null;
  busy: boolean;
}

export interface PlayOnlineHandlers {
  create(): void;
  createFromSave(file: File): void;
  join(): void;
  back(): void;
  rerender(): void;
}

export function renderPlayOnline(d: PlayOnlineDraft, h: PlayOnlineHandlers): HTMLElement {
  const choice = <T,>(values: readonly T[], current: T, label: (v: T) => string, set: (v: T) => void, testid: string) =>
    el('div', { class: 'row' }, ...values.map((v) => button(label(v), () => { set(v); h.rerender(); }, { kind: current === v ? 'primary' : '', testid: `${testid}-${v}` })));
  const saveInput = el('input', {
    type: 'file', accept: '.json,application/json', style: 'display:none', 'data-testid': 'online-save-file',
    onchange: (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) h.createFromSave(f);
    },
  });
  return el('div', { class: 'panel setup col', 'data-testid': 'play-online' },
    el('h2', {}, t('online.title')),
    el('label', { class: 'row' }, el('span', {}, t('online.name')),
      el('input', {
        value: d.name, maxlength: 20, 'data-testid': 'online-name', autocomplete: 'nickname',
        oninput: (e) => (d.name = (e.target as HTMLInputElement).value),
      })),
    el('h3', {}, t('online.create')),
    el('div', { class: 'muted' }, t('online.createHelp')),
    el('div', { class: 'row' }, el('span', {}, t('setup.playerCount')),
      choice([2, 3, 4] as const, d.playerCount, String, (v) => (d.playerCount = v), 'online-players')),
    d.playerCount === 3
      ? el('div', { class: 'row' }, el('span', {}, t('setup.singleSide')),
          choice(['light', 'dark'] as const, d.singleSide, (s) => t(`side.${s}`), (v) => (d.singleSide = v), 'online-single'))
      : null,
    el('div', { class: 'row' }, el('span', {}, t('setup.mode')),
      choice(['draft', 'mirror'] as const, d.mode, (m) => t(`setup.mode.${m}`), (v) => (d.mode = v), 'online-mode')),
    el('div', { class: 'row' },
      button(t('online.create'), h.create, { kind: 'primary', testid: 'online-create', disabled: d.busy }),
      button(t('online.fromSave'), () => saveInput.click(), { testid: 'online-from-save', disabled: d.busy }),
      saveInput,
    ),
    el('h3', {}, t('online.join')),
    el('div', { class: 'muted' }, t('online.joinHelp')),
    el('div', { class: 'row' },
      el('input', {
        value: d.code, placeholder: t('online.code'), maxlength: 9, 'data-testid': 'online-code',
        oninput: (e) => (d.code = (e.target as HTMLInputElement).value),
      }),
      button(t('online.join'), h.join, { kind: 'primary', testid: 'online-join', disabled: d.busy }),
    ),
    d.busy ? el('div', { class: 'muted' }, t('online.connecting')) : null,
    d.error ? el('div', { class: 'error', 'data-testid': 'online-error' }, d.error) : null,
    el('div', { class: 'row' }, button(t('online.back'), h.back, { testid: 'online-back' })),
  );
}

function slotLabel(s: SeatView): string {
  return s.heroSlots.length > 1 ? t('online.bothHeroes') : t('online.heroSlot', { n: s.heroSlots[0] + 1 });
}

export interface LobbyHandlers {
  take(seat: SeatId): void;
  start(): void;
  release(seat: SeatId): void;
  copyLink(): void;
  leave(): void;
}

/** One seat line: side, hero slots, name (as text), you / away / free, and its button. */
function seatRow(room: RoomView, s: SeatView, h: LobbyHandlers): HTMLElement {
  const mine = room.you === s.id;
  const creatorAway = !room.seats.find((x) => x.id === room.creatorSeat)?.connected;
  const mayRelease = !!room.you && !mine && s.taken && !s.connected && (room.you === room.creatorSeat || creatorAway);
  const status = !s.taken ? t('online.free') : mine ? t('online.you') : s.connected ? '' : t('online.away');
  return el('div', { class: `row seat ${s.side}`, 'data-testid': `seat-${s.id}` },
    el('span', { class: s.side }, `${t(`side.${s.side}`)} · ${slotLabel(s)}`),
    el('strong', { 'data-testid': `seat-name-${s.id}` }, s.name ?? '—'),
    status ? el('span', { class: 'muted', 'data-testid': `seat-status-${s.id}` }, status) : null,
    // The name is checked on click (a toast asks for it), so typing needs no re-render.
    !s.taken && !mine ? button(t('online.take'), () => h.take(s.id), { testid: `take-${s.id}` }) : null,
    mayRelease ? button(t('online.release'), () => h.release(s.id), { testid: `release-${s.id}` }) : null,
  );
}

export function renderLobby(room: RoomView, name: { value: string }, h: LobbyHandlers): HTMLElement {
  const creator = room.seats.find((s) => s.id === room.creatorSeat);
  const full = room.seats.every((s) => s.taken);
  const isCreator = room.you !== null && room.you === room.creatorSeat;
  return el('div', { class: 'panel setup col', 'data-testid': 'lobby' },
    el('h2', { 'data-testid': 'lobby-code' }, t('online.lobby', { code: room.code })),
    el('div', { class: 'row' }, button(t('online.copyLink'), h.copyLink, { testid: 'copy-link' })),
    room.you ? null : el('label', { class: 'row' }, el('span', {}, t('online.name')),
      el('input', { value: name.value, maxlength: 20, 'data-testid': 'online-name', oninput: (e) => (name.value = (e.target as HTMLInputElement).value) })),
    el('h3', {}, room.you ? t('online.seatList') : t('online.chooseSeat')),
    ...room.seats.map((s) => seatRow(room, s, h)),
    el('div', { class: 'muted' }, t('online.autoSetup')),
    room.status === 'lobby'
      ? isCreator
        ? button(t('online.start'), h.start, { kind: 'primary', testid: 'online-start', disabled: !full })
        : el('div', { class: 'muted', 'data-testid': 'lobby-wait' }, full ? t('online.waitingCreator', { name: creator?.name ?? '' }) : t('online.waitingSeats'))
      : null,
    el('div', { class: 'row' }, button(t('online.leave'), h.leave, { testid: 'online-leave' })),
  );
}

/** A small bar above the HUD in online games: seats with away markers and whose move it is. */
export function renderOnlineBar(room: RoomView, waiting: SeatId[], status: 'connected' | 'reconnecting' | 'closed'): HTMLElement {
  const mine = !!room.you && waiting.includes(room.you);
  const names = waiting.map((id) => room.seats.find((s) => s.id === id)?.name ?? id).join(', ');
  return el('div', { class: 'panel online-bar row', 'data-testid': 'online-bar' },
    el('strong', {}, room.code),
    ...room.seats.map((s) => el('span', { class: `${s.side}${s.connected ? '' : ' away'}`, 'data-testid': `bar-seat-${s.id}` },
      `${s.name ?? '—'}${s.connected ? '' : ` (${t('online.away')})`}`)),
    status === 'reconnecting' ? el('span', { class: 'error', 'data-testid': 'online-reconnecting' }, t('online.reconnecting')) : null,
    status === 'closed' ? el('span', { class: 'error' }, t('online.closed')) : null,
    waiting.length
      ? el('span', { class: mine ? 'your-turn' : 'muted', 'data-testid': 'online-waiting' }, mine ? t('online.yourTurn') : t('online.waitingFor', { name: names }))
      : null,
  );
}
