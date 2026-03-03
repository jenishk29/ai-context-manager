import * as crypto from 'crypto';
import * as path from 'path';
import type { ContextEvent } from './types';

export function isoNow(): string {
  return new Date().toISOString();
}

export function generateEventId(): string {
  // Short, URL-safe-ish id: evt- + 16 hex chars
  return `evt-${crypto.randomBytes(8).toString('hex')}`;
}

export function sortByTimestampDesc(a: ContextEvent, b: ContextEvent): number {
  // ISO8601 lexicographic order matches chronological order
  return b.timestamp.localeCompare(a.timestamp);
}

export function sortByTimestampAsc(a: ContextEvent, b: ContextEvent): number {
  return a.timestamp.localeCompare(b.timestamp);
}

export function normalizeStoragePath(storagePath: string): string {
  return path.resolve(process.cwd(), storagePath);
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
