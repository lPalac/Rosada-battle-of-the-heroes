// 005 T026 / research R-11: per-connection message rate and per-address room creation limits.
import { ONLINE } from '../src/online/limits.ts';

/** Messages over the per-second limit are dropped; repeated bursts (strikes) within a minute disconnect. */
export class RateLimiter {
  private windowStart = 0;
  private count = 0;
  private strikes: number[] = [];

  constructor(private readonly perSecond = ONLINE.messagesPerSecond, private readonly maxStrikes = ONLINE.strikesBeforeDisconnect) {}

  /** 'ok' to handle the message, 'drop' to ignore it, 'kick' to disconnect the client. */
  hit(now: number): 'ok' | 'drop' | 'kick' {
    if (now - this.windowStart >= 1000) {
      this.windowStart = now;
      this.count = 0;
    }
    this.count++;
    if (this.count <= this.perSecond) return 'ok';
    if (this.count === this.perSecond + 1) {
      this.strikes = this.strikes.filter((t) => now - t < 60_000);
      this.strikes.push(now);
      if (this.strikes.length >= this.maxStrikes) return 'kick';
    }
    return 'drop';
  }
}

/** At most N room creations per address per hour. Addresses live only in memory and are forgotten once their hour
 * is over (FR-064, decided 2026-11-10: no client addresses on disk). */
export class CreationLimiter {
  private byIp = new Map<string, number[]>();

  constructor(private readonly perHour = ONLINE.createsPerIpPerHour) {}

  /** How many addresses are remembered now (tests). */
  get size(): number {
    return this.byIp.size;
  }

  private prune(now: number): void {
    for (const [ip, times] of this.byIp) if (times.every((t) => now - t >= 3600_000)) this.byIp.delete(ip);
  }

  allow(ip: string | undefined, now: number): boolean {
    this.prune(now);
    const key = ip ?? 'unknown';
    const recent = (this.byIp.get(key) ?? []).filter((t) => now - t < 3600_000);
    if (recent.length >= this.perHour) {
      this.byIp.set(key, recent);
      return false;
    }
    recent.push(now);
    this.byIp.set(key, recent);
    return true;
  }
}
