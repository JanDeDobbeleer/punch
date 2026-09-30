// Single-use markers in blob storage (replay protection for codes and refresh tokens).

import { RestError, type ContainerClient } from '@azure/storage-blob';
import { getBlobServiceClient } from '../blobClient.js';

const CONTAINER = 'mcp-auth';
let container: ContainerClient | null = null;
let ensured = false;

export async function getAuthContainer(): Promise<ContainerClient> {
  container ??= getBlobServiceClient().getContainerClient(CONTAINER);
  if (!ensured) {
    await container.createIfNotExists();
    ensured = true;
  }
  return container;
}

/** Returns true if this call consumed the marker; false if it was already consumed. */
export async function consumeOnce(kind: 'codes' | 'refresh', jti: string): Promise<boolean> {
  const c = await getAuthContainer();
  try {
    await c.getBlockBlobClient(`${kind}/${jti}`).upload('', 0, { conditions: { ifNoneMatch: '*' } });
    return true;
  } catch (error) {
    if (error instanceof RestError && (error.statusCode === 409 || error.statusCode === 412)) return false;
    throw error;
  }
}
