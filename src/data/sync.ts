import { DbDocument, documentsEqual } from './types';
import { mergeDocuments } from './merge';
import {
  createDatabase,
  findDatabaseFile,
  isConflict,
  readDatabase,
  writeDatabase,
} from '../drive/client';

export type SyncOutcome = {
  /** What the sync actually did; surfaced in the UI. */
  status: 'created' | 'in-sync' | 'pulled' | 'pushed';
  doc: DbDocument;
};

/**
 * Two-way sync of the single JSON document.
 *
 * Drive has no transactions: a write only succeeds if the ETag still matches,
 * and a 412 means another device won the race, so we re-read and merge again.
 * Photos are separate Drive files and are not touched here.
 */
export async function syncDocument(
  token: string,
  local: DbDocument,
  attempt = 0,
): Promise<SyncOutcome> {
  const file = await findDatabaseFile(token);

  if (!file) {
    await createDatabase(token, local);
    return { status: 'created', doc: local };
  }

  const remote = await readDatabase(token, file.id);
  const merged = mergeDocuments(local, remote.doc);

  if (documentsEqual(merged, remote.doc)) {
    return { status: documentsEqual(merged, local) ? 'in-sync' : 'pulled', doc: merged };
  }

  try {
    await writeDatabase(token, file.id, merged, remote.etag ?? undefined);
    return { status: 'pushed', doc: merged };
  } catch (error) {
    if (isConflict(error) && attempt < 2) {
      return syncDocument(token, merged, attempt + 1);
    }
    throw error;
  }
}
