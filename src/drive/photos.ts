import { Platform } from 'react-native';
import type { PhotoRef } from '../data/types';
import { DRIVE_API, UPLOAD_API, createAppDataFile, deleteFile } from './client';
import { PHOTO_FILE_PREFIX } from './config';

const mediaUrl = (fileId: string) => `${DRIVE_API}/files/${fileId}?alt=media`;

/** Web has no filesystem, so downloaded photos become object URLs. */
const webObjectUrls = new Map<string, string>();

function extensionFor(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('heic')) return 'heic';
  return 'jpg';
}

/**
 * Uploads a photo as its own appDataFolder file and returns the reference that
 * goes into the JSON document. Keeping photos out of the document matters: the
 * document is re-uploaded in full on every sync.
 */
export async function uploadPhoto(
  token: string,
  uri: string,
  mimeType: string,
): Promise<PhotoRef> {
  const name = `${PHOTO_FILE_PREFIX}${Date.now()}.${extensionFor(mimeType)}`;
  const fileId = await createAppDataFile(token, name, mimeType);

  try {
    await uploadBytes(token, fileId, uri, mimeType);
  } catch (error) {
    // Do not leave a broken, unreferenced file behind.
    await deleteFile(token, fileId).catch(() => undefined);
    throw error;
  }

  return { fileId, mimeType };
}

async function uploadBytes(
  token: string,
  fileId: string,
  uri: string,
  mimeType: string,
): Promise<void> {
  const url = `${UPLOAD_API}/files/${fileId}?uploadType=media`;

  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType },
      body: blob,
    });
    if (!response.ok) {
      throw new Error(`Photo upload failed (${response.status})`);
    }
    return;
  }

  const { File, UploadTask, UploadType } = await import('expo-file-system');
  const task = new UploadTask(new File(uri), url, {
    httpMethod: 'PATCH',
    uploadType: UploadType.BINARY_CONTENT,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType },
  });

  const result = await task.uploadAsync();
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Photo upload failed (${result.status})`);
  }
}

/**
 * Resolves a photo reference to something an <Image> can render.
 * File ids never change for an existing upload, so both caches are safe.
 */
export async function resolvePhotoUri(token: string, photo: PhotoRef): Promise<string> {
  if (Platform.OS === 'web') {
    const cached = webObjectUrls.get(photo.fileId);
    if (cached) return cached;

    const response = await fetch(mediaUrl(photo.fileId), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Photo download failed (${response.status})`);
    }

    const objectUrl = URL.createObjectURL(await response.blob());
    webObjectUrls.set(photo.fileId, objectUrl);
    return objectUrl;
  }

  const { File, Paths } = await import('expo-file-system');
  const destination = new File(Paths.cache, `${PHOTO_FILE_PREFIX}${photo.fileId}`);

  if (!destination.exists) {
    await File.downloadFileAsync(mediaUrl(photo.fileId), destination, {
      headers: { Authorization: `Bearer ${token}` },
      idempotent: true,
    });
  }

  return destination.uri;
}

export async function deletePhoto(token: string, photo: PhotoRef): Promise<void> {
  await deleteFile(token, photo.fileId);
}
