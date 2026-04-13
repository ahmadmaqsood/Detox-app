import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { subscribeAuth } from '@/lib/firebase';
import {
  getDetoxEnabled,
  setDetoxEnabled as persistDetox,
  getDetoxStreak,
  getDetoxStartDate,
} from "@/lib/firestoreDatabase";

interface DetoxContextValue {
  detox: boolean;
  streak: number;
  startedAt: string | null;
  ready: boolean;
  setDetox: (enabled: boolean) => Promise<void>;
  refreshStreak: () => Promise<void>;
}

const DetoxContext = createContext<DetoxContextValue>({
  detox: false,
  streak: 0,
  startedAt: null,
  ready: false,
  setDetox: async () => {},
  refreshStreak: async () => {},
});

export function DetoxProvider({ children }: { children: ReactNode }) {
  const [detox, setDetoxState] = useState(false);
  const [streak, setStreak] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const [enabled, s, sd] = await Promise.all([
      getDetoxEnabled(),
      getDetoxStreak(),
      getDetoxStartDate(),
    ]);
    setDetoxState(enabled);
    setStreak(s);
    setStartedAt(sd);
    setReady(true);
  }, []);

  useEffect(() => {
    return subscribeAuth((user) => {
      if (!user) {
        setDetoxState(false);
        setStreak(0);
        setStartedAt(null);
        setReady(true);
        return;
      }
      void load().catch(() => setReady(true));
    });
  }, [load]);

  const setDetox = useCallback(async (enabled: boolean) => {
    setDetoxState(enabled);
    try {
      await persistDetox(enabled);
      const [s, sd] = await Promise.all([getDetoxStreak(), getDetoxStartDate()]);
      setStreak(s);
      setStartedAt(sd);
    } catch {
      /* not signed in */
    }
  }, []);

  const refreshStreak = useCallback(async () => {
    try {
      const [s, sd] = await Promise.all([getDetoxStreak(), getDetoxStartDate()]);
      setStreak(s);
      setStartedAt(sd);
    } catch {
      /* not signed in */
    }
  }, []);

  return (
    <DetoxContext.Provider value={{ detox, streak, startedAt, ready, setDetox, refreshStreak }}>
      {children}
    </DetoxContext.Provider>
  );
}

export function useDetox() {
  return useContext(DetoxContext);
}
