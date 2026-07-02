import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface AuthUser {
  name: string;
  email: string;
  department: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AUTH_STORAGE_KEY = 'arvind_gcc_auth';

const DEMO_USERS: Record<string, { password: string; user: AuthUser }> = {
  'manav.raval@arvindgcc.com': {
    password: 'ArvindGCC@2026',
    user: {
      name: 'Manav Raval',
      email: 'manav.raval@arvindgcc.com',
      department: 'Human Resources',
    },
  },
  'kashish.bhagat@arvindgcc.com': {
    password: 'ArvindGCC@2026',
    user: {
      name: 'Kashish Bhagat',
      email: 'kashish.bhagat@arvindgcc.com',
      department: 'Human Resources',
    },
  },
};

function readStoredUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);

    // Brief delay for realistic UX
    await new Promise((r) => setTimeout(r, 800));

    const normalizedEmail = email.trim().toLowerCase();
    const account = DEMO_USERS[normalizedEmail];

    if (!account || account.password !== password) {
      setIsLoading(false);
      return {
        success: false,
        error: 'Invalid email or password. Please check your credentials and try again.',
      };
    }

    setUser(account.user);
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(account.user));
    setIsLoading(false);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
