import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserRole = 'viewer' | 'admin';

const ROLE_KEY = 'auth:role';

type RoleContextValue = {
  role: UserRole;
  isAdmin: boolean;
  setRole: (role: UserRole) => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>('viewer');

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(ROLE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored === 'admin' || stored === 'viewer') {
          setRoleState(stored);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const setRole = useCallback((next: UserRole) => {
    setRoleState(next);
    void AsyncStorage.setItem(ROLE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      isAdmin: role === 'admin',
      setRole,
    }),
    [role, setRole],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const value = useContext(RoleContext);
  if (!value) throw new Error('useRole must be used inside RoleProvider');
  return value;
}
