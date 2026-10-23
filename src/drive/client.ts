import { DbDocument, parseDocument } from '../data/types';
import { DB_FILE_NAME } from './config';

export const DRIVE_API = 'https://www.googleapis.com/drive/v3';
export const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

const FILE_FIELDS = 'id,name,modifiedTime';

export type DriveFile = {
  id: string;
  name?: string;
  modifiedTime?: string;
};

export type RemoteDatabase = {
  doc: DbDocument;
  /** ETag used for optimistic concurrency; null if Drive omitted it. */
  etag: string | null;
};

export class DriveError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DriveError';
    this.status = status;
  }
}

/** 412 means someone else wrote the file first. */
export const isConflict = (error: unknown): boolean =>
  error instanceof DriveError && error.status === 412;

/** 401/403 means the access token is gone or the scope was revoked. */
export const isAuthError = (error: unknown): boolean =>
  error instanceof DriveError && (error.status === 401 || error.status === 403);

export async function request(
  url: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };

  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new DriveError(
      `Drive request failed (${response.status}): ${detail.slice(0, 300)}`,
      response.status,
    );
  }
  return response;
}

/**
 * Creates a metadata-only file in appDataFolder and returns its id.
 * Simple media uploads cannot set `parents`, so binary content is written in a
 * second request via `uploadMedia`.
 */
export async function createAppDataFile(
  token: string,
  name: string,
  mimeType: string,
): Promise<string> {
  const response = await request(`${DRIVE_API}/files?fields=${encodeURIComponent(FILE_FIELDS)}`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType, parents: ['appDataFolder'] }),
  });

  const created = (await response.json()) as DriveFile;
  return created.id;
}

/** Streams bytes into an existing file. `method` is PATCH for updates. */
export async function uploadMedia(
  token: string,
  fileId: string,
  body: BodyInit,
  mimeType: string,
  method: 'POST' | 'PATCH' = 'PATCH',
  extraHeaders: Record<string, string> = {},
): Promise<void> {
  await request(`${UPLOAD_API}/files/${fileId}?uploadType=media`, token, {
    method,
    headers: { 'Content-Type': mimeType, ...extraHeaders },
    body,
  });
}

export async function deleteFile(token: string, fileId: string): Promise<void> {
  await request(`${DRIVE_API}/files/${fileId}`, token, { method: 'DELETE' });
}

/** Queries only the hidden appDataFolder space, not the user's visible Drive. */
export async function findDatabaseFile(token: string): Promise<DriveFile | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${DB_FILE_NAME}' and trashed=false`,
    fields: `files(${FILE_FIELDS})`,
    pageSize: '1',
  });

  const response = await request(`${DRIVE_API}/files?${params.toString()}`, token);
  const payload = (await response.json()) as { files?: DriveFile[] };
  return payload.files?.[0] ?? null;
}

export async function readDatabase(token: string, fileId: string): Promise<RemoteDatabase> {
  // Metadata first: the ETag lives on the file resource, not on the media body.
  const meta = await request(
    `${DRIVE_API}/files/${fileId}?fields=${encodeURIComponent(FILE_FIELDS)}`,
    token,
  );
  const etag = meta.headers.get('etag');

  const media = await request(`${DRIVE_API}/files/${fileId}?alt=media`, token);
  return { doc: parseDocument(await media.text()), etag };
}

export async function writeDatabase(
  token: string,
  fileId: string,
  doc: DbDocument,
  etag?: string,
): Promise<void> {
  const extraHeaders: Record<string, string> = {};
  if (etag) extraHeaders['If-Match'] = etag;

  await uploadMedia(token, fileId, JSON.stringify(doc), 'application/json', 'PATCH', extraHeaders);
}

export async function createDatabase(token: string, doc: DbDocument): Promise<DriveFile> {
  const fileId = await createAppDataFile(token, DB_FILE_NAME, 'application/json');
  await writeDatabase(token, fileId, doc);
  return { id: fileId };
}
