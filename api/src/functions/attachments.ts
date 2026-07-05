// POST /api/attachments
//   body: { entryId, fileName, contentType }
//   -> issues a short-lived SAS URL the browser can PUT the file bytes to directly
//      (keeps large uploads off the Function's request/response path entirely).
//      Original fileName/contentType are stored as blob metadata.
//
// GET /api/attachments/{entryId}/{attachmentId}
//   -> issues a short-lived read-only SAS URL to download/preview the file.
//
// DELETE /api/attachments/{entryId}/{attachmentId}
//   -> deletes the blob.

import { randomUUID } from 'node:crypto';
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { BlobSASPermissions, generateBlobSASQueryParameters, SASProtocol } from '@azure/storage-blob';
import { getAttachmentsContainerClient, getBlobServiceClient, getSharedKeyCredential } from '../blobClient.js';
import { requireOwner } from '../auth.js';

const SAS_TTL_MINUTES = 10;

function blobPathFor(entryId: string, attachmentId: string): string {
  return `${entryId}/${attachmentId}`;
}

async function createUploadUrl(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (!requireOwner(request)) {
    return { status: 401, jsonBody: { message: 'Not authenticated.' } };
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return { status: 400, jsonBody: { message: 'Body must be valid JSON.' } };
  }

  const body = payload as Partial<{ entryId: string; fileName: string; contentType: string }>;
  if (!body.entryId || !body.fileName) {
    return { status: 400, jsonBody: { message: 'entryId and fileName are required.' } };
  }

  const container = getAttachmentsContainerClient();
  await container.createIfNotExists();

  const attachmentId = randomUUID();
  const blobPath = blobPathFor(body.entryId, attachmentId);
  const blobClient = container.getBlockBlobClient(blobPath);

  try {
    const expiresOn = new Date(Date.now() + SAS_TTL_MINUTES * 60 * 1000);
    const uploadUrl = await signBlobUrl(blobClient.url, container.containerName, blobPath, expiresOn, 'write');

    return {
      status: 200,
      jsonBody: {
        attachmentId,
        blobPath,
        uploadUrl,
        expiresOn: expiresOn.toISOString(),
        fileName: body.fileName,
        contentType: body.contentType ?? 'application/octet-stream',
      },
    };
  } catch (error) {
    context.error('Failed to create attachment upload URL', error);
    return { status: 500, jsonBody: { message: 'Failed to create upload URL.' } };
  }
}

async function getDownloadUrl(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (!requireOwner(request)) {
    return { status: 401, jsonBody: { message: 'Not authenticated.' } };
  }

  const entryId = request.params.entryId;
  const attachmentId = request.params.attachmentId;
  if (!entryId || !attachmentId) {
    return { status: 400, jsonBody: { message: 'entryId and attachmentId are required.' } };
  }

  const container = getAttachmentsContainerClient();
  const blobPath = blobPathFor(entryId, attachmentId);
  const blobClient = container.getBlockBlobClient(blobPath);

  const exists = await blobClient.exists();
  if (!exists) {
    return { status: 404, jsonBody: { message: 'Attachment not found.' } };
  }

  try {
    const expiresOn = new Date(Date.now() + SAS_TTL_MINUTES * 60 * 1000);
    const downloadUrl = await signBlobUrl(blobClient.url, container.containerName, blobPath, expiresOn, 'read');
    return { status: 200, jsonBody: { downloadUrl, expiresOn: expiresOn.toISOString() } };
  } catch (error) {
    context.error('Failed to create attachment download URL', error);
    return { status: 500, jsonBody: { message: 'Failed to create download URL.' } };
  }
}

async function deleteAttachment(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (!requireOwner(request)) {
    return { status: 401, jsonBody: { message: 'Not authenticated.' } };
  }

  const entryId = request.params.entryId;
  const attachmentId = request.params.attachmentId;
  if (!entryId || !attachmentId) {
    return { status: 400, jsonBody: { message: 'entryId and attachmentId are required.' } };
  }

  const container = getAttachmentsContainerClient();
  const blobPath = blobPathFor(entryId, attachmentId);

  try {
    await container.getBlockBlobClient(blobPath).deleteIfExists();
    return { status: 204 };
  } catch (error) {
    context.error('Failed to delete attachment', error);
    return { status: 500, jsonBody: { message: 'Failed to delete attachment.' } };
  }
}

// Signs a blob URL for a limited time and permission set. Uses an account
// shared key when configured (simplest for a single-account setup); falls
// back to a user-delegation SAS backed by the Function's managed identity
// when only PUNCH_STORAGE_ACCOUNT_URL is configured (no static account key
// stored anywhere).
async function signBlobUrl(
  blobUrl: string,
  containerName: string,
  blobPath: string,
  expiresOn: Date,
  access: 'read' | 'write',
): Promise<string> {
  const sharedKeyCredential = getSharedKeyCredential();
  const permissions = access === 'read' ? BlobSASPermissions.parse('r') : BlobSASPermissions.parse('cw');

  if (sharedKeyCredential) {
    const sas = generateBlobSASQueryParameters(
      {
        containerName,
        blobName: blobPath,
        permissions,
        protocol: SASProtocol.Https,
        expiresOn,
      },
      sharedKeyCredential,
    ).toString();
    return `${blobUrl}?${sas}`;
  }

  const blobServiceClient = getBlobServiceClient();
  const startsOn = new Date(Date.now() - 5 * 60 * 1000);
  const userDelegationKey = await blobServiceClient.getUserDelegationKey(startsOn, expiresOn);
  const sas = generateBlobSASQueryParameters(
    {
      containerName,
      blobName: blobPath,
      permissions,
      protocol: SASProtocol.Https,
      startsOn,
      expiresOn,
    },
    userDelegationKey,
    blobServiceClient.accountName,
  ).toString();
  return `${blobUrl}?${sas}`;
}

app.http('createAttachmentUploadUrl', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'attachments',
  handler: createUploadUrl,
});

app.http('getAttachmentDownloadUrl', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'attachments/{entryId}/{attachmentId}',
  handler: getDownloadUrl,
});

app.http('deleteAttachment', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'attachments/{entryId}/{attachmentId}',
  handler: deleteAttachment,
});
