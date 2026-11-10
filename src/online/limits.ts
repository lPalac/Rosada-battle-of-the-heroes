// 005: online tunables (src/data/online.json, constitution III).
import onlineJson from '../data/online.json';

export interface OnlineLimits {
  codeLength: number;
  codeAlphabet: string;
  nameMax: number;
  intentMaxBytes: number;
  maxPayloadBytes: number;
  messagesPerSecond: number;
  strikesBeforeDisconnect: number;
  createsPerIpPerHour: number;
  maxRooms: number;
  reconnectionSeconds: number;
  lifetimeHours: { playing: number; other: number };
}

export const ONLINE: OnlineLimits = onlineJson as OnlineLimits;
