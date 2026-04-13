import type { User } from "firebase/auth";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { subscribeAuth } from "@/lib/firebase";

type AuthContextValue = {
  /** Firebase user, or null when signed out. */
  user: User | null;
  /** First auth state event has been received (persistence restored or confirmed guest). */
  ready: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  ready: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    return subscribeAuth((u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
    }),
    [user, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
