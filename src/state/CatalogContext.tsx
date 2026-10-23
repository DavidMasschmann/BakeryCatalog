import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ProductInput, applyProductEdit, createProduct, tombstone, validateProductInput } from '../data/catalog';
import { newId } from '../data/id';
import { loadLocalDocument, saveLocalDocument } from '../data/repository';
import { syncDocument, type SyncOutcome } from '../data/sync';
import {
  DbDocument,
  PhotoRef,
  Product,
  emptyDocument,
  normalizeDocument,
  visibleProducts,
} from '../data/types';
import { deletePhoto, uploadPhoto } from '../drive/photos';
import { describeDriveError } from '../drive/errors';
import { useAuth } from './AuthContext';

export type PendingPhoto = {
  uri: string;
  mimeType: string;
};

export type ProductDraft = ProductInput & {
  /** Local images that still need to be uploaded to Drive on save. */
  pendingPhotos?: PendingPhoto[] | null;
};

/** Coarse status for the header indicator; `message` carries the detail. */
export type SyncState = 'local' | 'syncing' | 'synced' | 'error';

type CatalogContextValue = {
  products: Product[];
  loading: boolean;
  message: string;
  syncing: boolean;
  syncState: SyncState;
  getProduct: (id: string) => Product | undefined;
  saveProduct: (draft: ProductDraft, productId?: string) => Promise<void>;
  removeProduct: (productId: string) => Promise<void>;
  sync: () => Promise<void>;
};

const SYNC_MESSAGES: Record<SyncOutcome['status'], string> = {
  created: 'Catálogo criado no Google Drive',
  'in-sync': 'Sincronizado com o Google Drive',
  pulled: 'Atualizado do Google Drive',
  pushed: 'Salvo no Google Drive',
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const [doc, setDoc] = useState<DbDocument>(emptyDocument);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('Salvo neste dispositivo');
  const [syncState, setSyncState] = useState<SyncState>('local');

  // Sync runs outside React's render cycle, so it reads the newest document and
  // serialises itself through refs rather than through state closures.
  const docRef = useRef<DbDocument>(emptyDocument());
  const syncingRef = useRef(false);
  const queuedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadLocalDocument().then((loaded) => {
      if (cancelled) return;
      docRef.current = loaded;
      setDoc(loaded);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Local cache is written before any network call so the app stays usable offline.
  const persist = useCallback(async (next: DbDocument) => {
    docRef.current = next;
    setDoc(next);
    await saveLocalDocument(next);
  }, []);

  /**
   * Pull + merge + push. At most one request runs at a time: a mutation that
   * arrives mid-flight sets `queuedRef`, and the loop repeats with the newer
   * document instead of racing a second write against the same ETag.
   */
  const runSync = useCallback(
    async ({ announce }: { announce: boolean }) => {
      const token = accessToken;
      if (!token) {
        if (announce) {
          setMessage('Conecte o Google Drive em Configurações primeiro');
          setSyncState('error');
        }
        return;
      }

      if (syncingRef.current) {
        queuedRef.current = true;
        return;
      }

      syncingRef.current = true;
      setSyncing(true);
      setSyncState('syncing');
      setMessage('Sincronizando...');

      try {
        do {
          queuedRef.current = false;
          const outcome = await syncDocument(token, docRef.current);
          await persist(outcome.doc);
          setMessage(SYNC_MESSAGES[outcome.status]);
        } while (queuedRef.current);
        setSyncState('synced');
      } catch (error) {
        queuedRef.current = false;
        setMessage(describeDriveError(error));
        setSyncState('error');
      } finally {
        syncingRef.current = false;
        setSyncing(false);
      }
    },
    [accessToken, persist],
  );

  // Fetch from Drive on launch, and again whenever a session appears. Deferred
  // out of the effect body: runSync sets state immediately, which React flags as
  // a cascading render if done during the effect.
  useEffect(() => {
    if (loading || !accessToken) return;
    const timer = setTimeout(() => {
      void runSync({ announce: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [loading, accessToken, runSync]);

  const saveProduct = useCallback(
    async (draft: ProductDraft, productId?: string) => {
      const now = Date.now();
      const pendingPhotos = draft.pendingPhotos ?? [];
      const input: ProductInput = {
        name: draft.name,
        description: draft.description,
        priceCents: draft.priceCents,
        category: draft.category ?? null,
        fillings: draft.fillings,
        photos: draft.photos,
      };

      // Validate before uploading so an invalid form never creates orphan files.
      const problem = validateProductInput(input);
      if (problem) throw new Error(problem);

      if (pendingPhotos.length > 0 && !accessToken) {
        throw new Error('Conecte o Google Drive em Configurações para anexar fotos.');
      }

      const uploaded: PhotoRef[] = [];
      for (const pending of pendingPhotos) {
        try {
          uploaded.push(await uploadPhoto(accessToken!, pending.uri, pending.mimeType));
        } catch (cause) {
          if (accessToken) {
            await Promise.allSettled(uploaded.map((photo) => deletePhoto(accessToken, photo)));
          }
          throw new Error(describeDriveError(cause));
        }
      }

      const savedInput: ProductInput = {
        ...input,
        photos: [...input.photos, ...uploaded],
      };

      const current = docRef.current;
      const existing = productId
        ? current.products.find((product) => product.id === productId)
        : undefined;
      const saved = existing
        ? applyProductEdit(existing, savedInput, now)
        : createProduct(savedInput, newId(), now);

      await persist(
        normalizeDocument([
          ...current.products.filter((product) => product.id !== saved.id),
          saved,
        ]),
      );

      // Removing a photo orphans its Drive file; clean up whatever is no longer
      // referenced now that the document write has succeeded.
      if (existing && accessToken) {
        const kept = new Set(saved.photos.map((photo) => photo.fileId));
        const removed = existing.photos.filter((photo) => !kept.has(photo.fileId));
        await Promise.allSettled(removed.map((photo) => deletePhoto(accessToken, photo)));
      }

      void runSync({ announce: false });
    },
    [accessToken, persist, runSync],
  );

  const removeProduct = useCallback(
    async (productId: string) => {
      const current = docRef.current;
      const existing = current.products.find((product) => product.id === productId);
      if (!existing) return;

      const now = Date.now();
      await persist(
        normalizeDocument(
          current.products.map((product) =>
            product.id === productId ? tombstone(product, now) : product,
          ),
        ),
      );

      if (existing.photos.length > 0 && accessToken) {
        await Promise.allSettled(existing.photos.map((photo) => deletePhoto(accessToken, photo)));
      }

      void runSync({ announce: false });
    },
    [accessToken, persist, runSync],
  );

  const sync = useCallback(() => runSync({ announce: true }), [runSync]);

  const value = useMemo<CatalogContextValue>(
    () => ({
      products: visibleProducts(doc),
      loading,
      message,
      syncing,
      syncState,
      getProduct: (id: string) => doc.products.find((product) => product.id === id && !product.deleted),
      saveProduct,
      removeProduct,
      sync,
    }),
    [doc, loading, message, syncing, syncState, saveProduct, removeProduct, sync],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextValue {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('useCatalog must be used inside CatalogProvider');
  return value;
}
