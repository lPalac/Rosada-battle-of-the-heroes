// 005 T034, T035, T044: the online flow in the browser: Play online → lobby → picks → the shared table.
// Seat tokens live in localStorage (`rosada.seat.<code>`, FR-040); the room link is `#/room/<code>`.
import { t } from '../../i18n/strings.ts';
import { browserEndpoint, GameServer, JoinError, type RoomConnection } from '../../net/client.ts';
import { OnlineSession } from '../../net/online-session.ts';
import { normaliseCode, cleanName } from '../../online/codes.ts';
import type { SeatId } from '../../online/model.ts';
import { BUILD_ID, dataHash } from '../../online/version.ts';
import { el, button } from '../dom.ts';
import { readSaveFile } from '../storage.ts';
import { renderLobby, renderPlayOnline, type PlayOnlineDraft } from './screens.ts';

export interface OnlineHost {
  /** The online session is ready (first snapshot): use it for the table and HUD. */
  attach(session: OnlineSession): void;
  /** Back to hot-seat / the setup wizard. */
  detach(): void;
  render(): void;
  toast(message: string, error?: boolean): void;
}

interface StoredSeat {
  seat: SeatId;
  token: string;
  name: string;
}

const seatKey = (code: string) => `rosada.seat.${code}`;

function read<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: the seat cannot be kept across reloads */
  }
}

export function roomCodeFromHash(hash: string): string | null {
  const m = /^#\/room\/([A-Za-z0-9-]+)$/.exec(hash);
  return m ? normaliseCode(m[1]) : null;
}

export class OnlineController {
  screen: 'off' | 'menu' | 'room' = 'off';
  session: OnlineSession | null = null;
  conn: RoomConnection | null = null;
  status: 'connected' | 'reconnecting' | 'closed' = 'connected';
  private draft: PlayOnlineDraft;
  private lobbyName: { value: string };
  private serverInstance: GameServer | null = null;
  /** Created on first use, so hot-seat games never touch the network code. */
  private get server(): GameServer {
    return (this.serverInstance ??= new GameServer(browserEndpoint(location)));
  }

  constructor(private readonly root: HTMLElement, private readonly host: OnlineHost) {
    const name = read<string>('rosada.name') ?? '';
    this.draft = { name, code: '', playerCount: 2, singleSide: 'light', mode: 'draft', error: null, busy: false };
    this.lobbyName = { value: name };
  }

  get active(): boolean {
    return this.screen !== 'off';
  }

  private get version() {
    return { buildId: BUILD_ID, dataHash: dataHash() };
  }

  openMenu(): void {
    this.screen = 'menu';
    this.draft.error = null;
    this.host.render();
  }

  private fail(e: unknown): void {
    const reason = e instanceof JoinError ? e.reason : 'SERVER_UNAVAILABLE';
    this.draft.error = t(`online.error.${reason}`);
    this.draft.busy = false;
    this.screen = 'menu';
    if (reason === 'VERSION_MISMATCH') this.versionPrompt();
    this.host.render();
  }

  /** US5-AS3: an old page asks to reload instead of joining. */
  private versionPrompt(): void {
    this.host.toast(t('online.error.VERSION_MISMATCH'), true);
  }

  private rememberName(name: string): void {
    write('rosada.name', name);
    this.lobbyName.value = name;
  }

  async create(save?: File): Promise<void> {
    const name = cleanName(this.draft.name);
    if (!name) {
      this.draft.error = t('online.nameNeeded');
      return this.host.render();
    }
    this.rememberName(name);
    this.draft.busy = true;
    this.draft.error = null;
    this.host.render();
    try {
      const saveFile = save ? await readSaveFile(save) : undefined;
      const conn = await this.server.create({
        name, playerCount: this.draft.playerCount, mode: this.draft.mode, singleSide: this.draft.singleSide,
        ...(saveFile ? { save: saveFile } : {}), ...this.version,
      });
      await this.enter(conn, name);
    } catch (e) {
      if (e instanceof JoinError) return this.fail(e);
      this.draft.error = e instanceof Error ? e.message : String(e);
      this.draft.busy = false;
      this.host.render();
    }
  }

  async join(rawCode: string = this.draft.code): Promise<void> {
    const code = normaliseCode(rawCode);
    if (!code) {
      this.draft.error = t('online.badCode');
      this.screen = 'menu';
      return this.host.render();
    }
    const stored = read<StoredSeat>(seatKey(code));
    this.draft.busy = true;
    this.draft.error = null;
    this.screen = 'menu';
    this.host.render();
    try {
      const conn = await this.server.join(code, { ...this.version, ...(stored ? { seatToken: stored.token } : {}) });
      await this.enter(conn, stored?.name ?? this.draft.name);
    } catch (e) {
      // A stale token (room gone) is forgotten so the next try starts clean.
      if (e instanceof JoinError && e.reason === 'ROOM_NOT_FOUND') write(seatKey(code), null);
      this.fail(e);
    }
  }

  private async enter(conn: RoomConnection, name: string): Promise<void> {
    this.conn = conn;
    const session = new OnlineSession(conn);
    this.session = session;
    session.onSeatToken((tk) => write(seatKey(conn.code), { seat: tk.seat, token: tk.token, name: cleanName(this.lobbyName.value) ?? name } satisfies StoredSeat));
    session.onRoom(() => this.host.render());
    conn.onStatus((s) => {
      if (this.conn !== conn) return; // an older connection
      this.status = s;
      // Closed without the player leaving, or a reconnect that does not come back (the server restarted, e.g. a
      // deploy, so the old reconnection token is gone): rejoin with the seat token (FR-044).
      if (s === 'closed') void this.rejoin(conn.code);
      if (s === 'reconnecting') {
        setTimeout(() => {
          if (this.conn === conn && this.status === 'reconnecting') void this.rejoin(conn.code, 0);
        }, 4000);
      }
      this.host.render();
    });
    await session.ready();
    this.draft.busy = false;
    this.screen = 'room';
    this.status = 'connected';
    if (location.hash !== `#/room/${conn.code}`) history.replaceState(null, '', `#/room/${conn.code}`);
    this.host.attach(session);
  }

  /** Try to get back into the same room for about a minute (the server restarts in a few seconds on a deploy). */
  private rejoining = false;

  private async rejoin(code: string, firstDelay = 2000): Promise<void> {
    if (this.rejoining) return;
    this.rejoining = true;
    try {
      const stored = read<StoredSeat>(seatKey(code));
      const old = this.conn;
      for (let attempt = 0; attempt < 30 && this.screen === 'room' && this.conn === old; attempt++) {
        await new Promise((r) => setTimeout(r, attempt === 0 ? firstDelay : 2000));
        if (this.screen !== 'room' || this.conn !== old) return;
        try {
          const conn = await this.server.join(code, { ...this.version, ...(stored ? { seatToken: stored.token } : {}) });
          await this.enter(conn, stored?.name ?? this.draft.name);
          void old?.leave().catch(() => {}); // stop the old connection's own retries
          return;
        } catch (e) {
          if (e instanceof JoinError && e.reason !== 'SERVER_UNAVAILABLE') return this.fail(e);
        }
      }
    } finally {
      this.rejoining = false;
    }
  }

  async leave(): Promise<void> {
    const conn = this.conn;
    this.conn = null;
    this.session = null;
    this.screen = 'off';
    if (location.hash.startsWith('#/room/')) history.replaceState(null, '', location.pathname + location.search);
    this.host.detach();
    await conn?.leave().catch(() => {});
  }

  /** True while the lobby or the menu fills the overlay (no table HUD yet). */
  ownsOverlay(): boolean {
    if (this.screen === 'menu') return true;
    return this.screen === 'room' && (!this.session || this.session.loading || this.session.room?.status === 'lobby');
  }

  render(): void {
    if (this.screen === 'menu') {
      this.root.replaceChildren(renderPlayOnline(this.draft, {
        create: () => void this.create(),
        createFromSave: (f) => void this.create(f),
        join: () => void this.join(),
        back: () => {
          this.screen = 'off';
          this.host.detach();
        },
        rerender: () => this.host.render(),
      }));
      return;
    }
    const s = this.session;
    if (!s || s.loading || !s.room) {
      this.root.replaceChildren(el('div', { class: 'panel setup' }, t('online.connecting')));
      return;
    }
    this.root.replaceChildren(renderLobby(s.room, this.lobbyName, {
      take: (seat) => {
        const name = cleanName(this.lobbyName.value);
        if (!name && !s.mySeat) return this.host.toast(t('online.nameNeeded'), true);
        this.rememberName(name ?? this.lobbyName.value);
        s.takeSeat(seat, name ?? this.lobbyName.value);
      },
      start: () => s.start(),
      release: (seat) => s.release(seat),
      copyLink: () => {
        const link = `${location.origin}${location.pathname}#/room/${s.room!.code}`;
        void navigator.clipboard?.writeText(link).then(() => this.host.toast(t('online.linkCopied')), () => this.host.toast(link));
      },
      leave: () => void this.leave(),
    }));
  }

  /** The picks screen header for a seat that is not picking now. */
  waitingPanel(names: string, picks: HTMLElement): HTMLElement {
    return el('div', { class: 'panel setup col', 'data-testid': 'online-pick-wait' },
      el('h3', {}, t('online.waitingFor', { name: names })),
      picks,
      el('div', { class: 'muted' }, t('online.autoSetup')),
      el('div', { class: 'row' }, button(t('online.leave'), () => void this.leave(), { testid: 'online-leave' })),
    );
  }
}
