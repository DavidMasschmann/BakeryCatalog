import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCAL_DB_KEY } from '../drive/config';
import { DbDocument, emptyDocument, normalizeDocument, parseDocument } from './types';

export async function loadLocalDocument(): Promise<DbDocument> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_DB_KEY);
    return raw ? parseDocument(raw) : emptyDocument();
  } catch {
    return emptyDocument();
  }
}

export async function saveLocalDocument(doc: DbDocument): Promise<void> {
  await AsyncStorage.setItem(LOCAL_DB_KEY, JSON.stringify(normalizeDocument(doc.products)));
}
