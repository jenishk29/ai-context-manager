import * as fs from 'fs';
import * as path from 'path';
import { ContextEventsError, ERROR_CODES } from './errors';

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJsonIfExists(filePath: string): unknown {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (cause) {
    throw new ContextEventsError({
      error_code: ERROR_CODES.STORAGE_READ_FAILED,
      message: `Failed to read JSON at ${filePath}`,
      cause,
    });
  }
}

export function writeJsonAtomic(filePath: string, data: unknown): void {
  try {
    const dir = path.dirname(filePath);
    ensureDir(dir);
    const tmp = `${filePath}.tmp`;
    const payload = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmp, payload, 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (cause) {
    throw new ContextEventsError({
      error_code: ERROR_CODES.STORAGE_WRITE_FAILED,
      message: `Failed to write JSON at ${filePath}`,
      cause,
    });
  }
}
