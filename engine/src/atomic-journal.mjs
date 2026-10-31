// Single-host, single-filesystem compare-and-append journal guard.
// NOT a distributed lock: production multi-host dispatch requires transactional storage.
import {appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, fsyncSync} from 'node:fs';
import {dirname} from 'node:path';

export function appendJournalEvent(file, event, expectedCount, expectedLastId = null) {
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 0) throw Error('Invalid journal checkpoint');
  mkdirSync(dirname(file), {recursive: true});
  const lock = file + '.lock';
  let fd;
  try {
    // O_EXCL: only one process on the same filesystem can enter this section.
    fd = openSync(lock, 'wx', 0o600);
  } catch (error) {
    if (error?.code === 'EEXIST') throw Error('Journal busy; retry with a fresh queue snapshot');
    throw error;
  }
  try {
    const raw = existsSync(file) ? readFileSync(file, 'utf8') : '';
    if (raw && !raw.endsWith('\n')) throw Error('Incomplete journal record; manual recovery required');
    const lines = raw ? raw.trimEnd().split('\n') : [];
    if (lines.length !== expectedCount) throw Error('Stale queue snapshot; reload before retry');
    const last = lines.length ? JSON.parse(lines.at(-1)) : null;
    if ((last?.eventId ?? null) !== expectedLastId) throw Error('Journal checkpoint mismatch; reload before retry');
    const out = openSync(file, 'a', 0o600);
    try {
      appendFileSync(out, JSON.stringify(event) + '\n', 'utf8');
      fsyncSync(out);
    } finally { closeSync(out); }
  } finally {
    closeSync(fd);
    unlinkSync(lock);
  }
}
