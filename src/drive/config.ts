/**
 * EXPO_PUBLIC_* values are inlined into the client bundle at build time, so
 * only ever put non-secret identifiers here. OAuth client IDs are public.
 */
export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

/**
 * drive.appdata is a hidden per-app folder: it keeps the catalog out of the
 * user's normal Drive listing and limits the grant to files this app created.
 */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

/** Only used to show which account is connected in Settings. */
export const ACCOUNT_SCOPES = ['email', 'profile'];

/** Single JSON document that acts as the database. */
export const DB_FILE_NAME = 'catalog.json';

/**
 * AsyncStorage key for the local cache. It keeps its v2 name so existing
 * devices retain their data; the stored document itself is now version 3.
 */
export const LOCAL_DB_KEY = 'catalog:v2';

/** Product photos live beside the database as individual Drive files. */
export const PHOTO_FILE_PREFIX = 'photo-';

/** ISO 4217 code used to render prices. Change to match your shop. */
export const CURRENCY = 'BRL';
