import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CatalogView = 'list' | 'grid';

const VIEW_KEY = 'catalog:view';

/** Catalog layout choice, persisted like the theme so it survives reloads. */
export function useViewPreference() {
  const [view, setViewState] = useState<CatalogView>('list');

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(VIEW_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored === 'list' || stored === 'grid') setViewState(stored);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const setView = useCallback((next: CatalogView) => {
    setViewState(next);
    void AsyncStorage.setItem(VIEW_KEY, next).catch(() => undefined);
  }, []);

  return { view, setView };
}
