import { createContext, useContext, type ReactNode } from 'react';
import { useGoogleSession, type GoogleSession } from '../drive/auth';

const AuthContext = createContext<GoogleSession | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useGoogleSession();
  return <AuthContext.Provider value={session}>{children}</AuthContext.Provider>;
}

export function useAuth(): GoogleSession {
  const session = useContext(AuthContext);
  if (!session) throw new Error('useAuth must be used inside AuthProvider');
  return session;
}
