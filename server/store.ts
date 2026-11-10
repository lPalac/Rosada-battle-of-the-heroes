// 005 T042 / research R-09: one JSON file per room, written atomically, outside the releases (survives deploys).
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RoomFile } from '../src/online/model.ts';

const CODE = /^[A-Z0-9]{4,16}$/;

export class RoomStore {
  constructor(readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  private path(code: string): string {
    if (!CODE.test(code)) throw new Error(`Bad room code ${code}`);
    return join(this.dir, `${code}.json`);
  }

  save(file: RoomFile): void {
    const target = this.path(file.room.code);
    const tmp = `${target}.tmp`;
    writeFileSync(tmp, JSON.stringify(file));
    renameSync(tmp, target);
  }

  load(code: string): RoomFile | null {
    try {
      return JSON.parse(readFileSync(this.path(code), 'utf8')) as RoomFile;
    } catch {
      return null;
    }
  }

  codes(): string[] {
    return readdirSync(this.dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5))
      .filter((c) => CODE.test(c));
  }

  delete(code: string): void {
    rmSync(this.path(code), { force: true });
  }
}
