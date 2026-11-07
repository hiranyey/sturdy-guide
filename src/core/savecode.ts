// Portable save codes: the whole save, gzip-compressed and base64url-encoded,
// so a saga can be moved between devices or backed up as plain text.
import type { GameState } from './types';

const PREFIX_GZ = 'HB1.';
const PREFIX_RAW = 'HB0.';

function toB64url(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(text: string) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

export async function encodeSave(s: GameState): Promise<string> {
  // Pending UI state never travels: the importer starts on the map.
  const clean = { ...s, pending: null, pendingFight: null };
  const json = new TextEncoder().encode(JSON.stringify(clean));
  if (typeof CompressionStream !== 'undefined') {
    try {
      return PREFIX_GZ + toB64url(await pipe(json, new CompressionStream('gzip')));
    } catch { /* fall back to raw */ }
  }
  return PREFIX_RAW + toB64url(json);
}

export class SaveCodeError extends Error {}

export async function decodeSave(code: string): Promise<GameState> {
  const text = code.replace(/\s+/g, '');
  let bytes: Uint8Array;
  try {
    if (text.startsWith(PREFIX_GZ)) {
      if (typeof DecompressionStream === 'undefined') throw new SaveCodeError('This browser cannot read compressed save codes.');
      bytes = await pipe(fromB64url(text.slice(PREFIX_GZ.length)), new DecompressionStream('gzip'));
    } else if (text.startsWith(PREFIX_RAW)) bytes = fromB64url(text.slice(PREFIX_RAW.length));
    else throw new SaveCodeError('That doesn\'t look like a Hexbound save code (it should start with "HB1.").');
  } catch (e) {
    if (e instanceof SaveCodeError) throw e;
    throw new SaveCodeError('The save code is damaged or incomplete. Make sure you copied all of it.');
  }
  let s: GameState;
  try {
    s = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new SaveCodeError('The save code is damaged or incomplete. Make sure you copied all of it.');
  }
  if (!s || s.version !== 1 || !s.player || typeof s.seed !== 'number' || !s.pos) throw new SaveCodeError('That save code is from an incompatible version.');
  return s;
}
