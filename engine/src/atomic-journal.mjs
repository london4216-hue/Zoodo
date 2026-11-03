// Single-host, single-filesystem optimistic journal fence.
// This is NOT a distributed lock; multi-host execution needs transactional storage.
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';

export function appendJournalEvent(file, event, expectedCount, expectedLastId = null) {
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 0) throw Error('Invalid journal checkpoint');
  if (!event || typeof event !== 'object' || Array.isArray(event) || typeof event.eventId !== 'string')
    throw Error('Invalid journal event');
  mkdirSync(dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  let lockFd;
  try {
    lockFd = openSync(lock, 'wx', 0o600);
  } catch (error) {
    if (error?.code === 'EEXIST') throw Error('Journal busy; retry with a fresh queue snapshot');
    throw error;
  }
  try {
    const raw = existsSync(file) ? readFileSync(file, 'utf8') : '';
    if (raw && !raw.endsWith('\n')) throw Error('Incomplete journal record; recovery required');
    const lines = raw ? raw.slice(0, -1).split('\n') : [];
    if (lines.length !== expectedCount) throw Error('Stale queue snapshot; reload before retry');
    // The tail checkpoint alone cannot certify a journal with a corrupt
    // interior record. Reject it before adding further irreversible history.
    let last = null;
    for (let i = 0; i < lines.length; i++) {
      let record;
      try { record = JSON.parse(lines[i]); }
      catch { throw Error(i === lines.length - 1
        ? 'Invalid journal tail; recovery required'
        : 'Invalid journal record; recovery required'); }
      if (!record || typeof record !== 'object' || Array.isArray(record) ||
          typeof record.eventId !== 'string' || !record.eventId)
        throw Error('Invalid journal record; recovery required');
      last = record;
    }
    if ((last?.eventId ?? null) !== expectedLastId) throw Error('Journal checkpoint mismatch; reload before retry');
    const out = openSync(file, 'a', 0o600);
    try {
      const payload = Buffer.from(JSON.stringify(event) + '\n', 'utf8');
      let offset = 0;
      while (offset < payload.length) {
        const written = writeSync(out, payload, offset, payload.length - offset);
        if (!Number.isSafeInteger(written) || written <= 0) throw Error('Journal write failed');
        offset += written;
      }
      fsyncSync(out);
    } finally { closeSync(out); }
  } finally {
    closeSync(lockFd);
    unlinkSync(lock);
  }
}
