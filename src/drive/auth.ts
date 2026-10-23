import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { fetchAccount } from './account';
import { ACCOUNT_SCOPES, DRIVE_SCOPE, GOOGLE_CLIENT_ID } from './config';
import { describeAuthError } from './errors';

// Required on web so the redirect popup can hand the result back to the app.
WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

const TOKEN_KEY = 'google-access-token';

/** Must match expo.scheme in app.json and the redirect URI in Google Cloud. */
const REDIRECT_SCHEME = 'bakerycatalog';

type StoredToken = {
  accessToken: string;
  expiresAt: number;
  email: string | null;
};

export type GoogleSession = {
  ready: boolean;
  configured: boolean;
  accessToken: string | null;
  email: string | null;
  error: string | null;
  /** Shown in setup errors so the URI can be registered verbatim. */
  redirectUri: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

export const MISSING_CLIENT_ID_MESSAGE =
  'No OAuth client id. Put EXPO_PUBLIC_GOOGLE_CLIENT_ID in .env, then restart with `npx expo start --clear`.';

async function readStoredToken(): Promise<StoredToken | null> {
  try {
    const raw =
      Platform.OS === 'web'
        ? typeof localStorage === 'undefined'
          ? null
          : localStorage.getItem(TOKEN_KEY)
        : await (await import('expo-secure-store')).getItemAsync(TOKEN_KEY);

    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredToken>;
    if (typeof parsed.accessToken !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      expiresAt: parsed.expiresAt,
      email: typeof parsed.email === 'string' ? parsed.email : null,
    };
  } catch {
    return null;
  }
}

async function writeStoredToken(token: StoredToken | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return;
      if (token) localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
      else localStorage.removeItem(TOKEN_KEY);
      return;
    }
    const store = await import('expo-secure-store');
    if (token) await store.setItemAsync(TOKEN_KEY, JSON.stringify(token));
    else await store.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Persistence is best effort; the user can always sign in again.
  }
}

/**
 * Implicit-flow Google session.
 *
 * Google's token endpoint requires a client secret for "Web application"
 * clients, which cannot be shipped inside a public app, so every platform uses
 * response_type=token. Consequence: tokens last about an hour and there is no
 * refresh token, so the user re-authorises when one expires.
 */
export function useGoogleSession(): GoogleSession {
  const [token, setToken] = useState<StoredToken | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readStoredToken().then((stored) => {
      if (cancelled) return;
      setToken(stored);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Clear the token once it expires so the UI offers "Connect" again.
  useEffect(() => {
    if (!token) return;
    const delay = Math.max(0, token.expiresAt - Date.now()) + 1_000;
    const timer = setTimeout(() => {
      setToken(null);
      void writeStoredToken(null);
    }, delay);
    return () => clearTimeout(timer);
  }, [token]);

  const redirectUri = useMemo(
    () => AuthSession.makeRedirectUri({ scheme: REDIRECT_SCHEME, path: 'redirect' }),
    [],
  );

  const [, , promptAsync] = AuthSession.useAuthRequest(
    {
      // Placeholder keeps the hook usable before a real client id is configured.
      clientId: GOOGLE_CLIENT_ID || 'unconfigured.apps.googleusercontent.com',
      scopes: [DRIVE_SCOPE, ...ACCOUNT_SCOPES],
      responseType: AuthSession.ResponseType.Token,
      redirectUri,
      usePKCE: false,
    },
    discovery,
  );

  const signIn = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) {
      setError(MISSING_CLIENT_ID_MESSAGE);
      return;
    }

    setError(null);
    try {
      const result = await promptAsync();

      if (result.type === 'success') {
        const auth = result.authentication;
        if (!auth?.accessToken) {
          setError('Google did not return an access token. Try connecting again.');
          return;
        }

        const account = await fetchAccount(auth.accessToken);
        const next: StoredToken = {
          accessToken: auth.accessToken,
          expiresAt: Date.now() + (auth.expiresIn ?? 3600) * 1000,
          email: account.email,
        };
        setToken(next);
        void writeStoredToken(next);
        return;
      }

      if (result.type === 'error') {
        setError(describeAuthError(result.error?.code ?? result.params?.error, redirectUri));
      }
      // dismiss / cancel: the user backed out, nothing to report.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed.');
    }
  }, [promptAsync, redirectUri]);

  const signOut = useCallback(async () => {
    setToken(null);
    setError(null);
    await writeStoredToken(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    ready,
    configured: GOOGLE_CLIENT_ID.length > 0,
    accessToken: token?.accessToken ?? null,
    email: token?.email ?? null,
    error,
    redirectUri,
    signIn,
    signOut,
    clearError,
  };
}
