// Arming: the owner (via an SWA-authenticated call to /api/mcp-arm) opens a short window in
// which one MCP connection may be started. Stored as blob "armed" in the mcp-auth container.

import { RestError } from '@azure/storage-blob';
import { getAuthContainer } from './markers.js';

const ARMED_BLOB = 'armed';
export const ARM_WINDOW_MS = 5 * 60 * 1000;

/** Arms for 5 minutes (unconditional overwrite). Returns armedUntil in epoch ms. */
export async function arm(now: number = Date.now()): Promise<number> {
  const armedUntil = now + ARM_WINDOW_MS;
  const body = JSON.stringify({ armedUntil });
  const container = await getAuthContainer();
  await container.getBlockBlobClient(ARMED_BLOB).upload(body, Buffer.byteLength(body), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
  });
  return armedUntil;
}

export async function isArmed(now: number = Date.now()): Promise<boolean> {
  const container = await getAuthContainer();
  try {
    const buf = await container.getBlockBlobClient(ARMED_BLOB).downloadToBuffer();
    const parsed: unknown = JSON.parse(buf.toString('utf-8'));
    const until = parsed && typeof parsed === 'object' ? (parsed as { armedUntil?: unknown }).armedUntil : undefined;
    return typeof until === 'number' && Number.isFinite(until) && until > now;
  } catch (error) {
    if (error instanceof RestError && error.statusCode === 404) return false;
    if (error instanceof SyntaxError) return false;
    throw error;
  }
}

export async function disarm(): Promise<void> {
  const container = await getAuthContainer();
  await container.getBlockBlobClient(ARMED_BLOB).deleteIfExists();
}
