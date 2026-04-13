import { subscribeAuth } from "@/lib/firebase";
import {
  getHardMode,
  getHardModeStreak,
  setHardMode as persistHardMode,
} from "@/lib/firestoreDatabase";
import { rescheduleSmartNotifications } from "@/lib/smartNotifications";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface HardModeContextValue {
  hardMode: boolean;
  hardModeStreak: number;
  ready: boolean;
  setHardMode: (enabled: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

const HardModeContext = createContext<HardModeContextValue>({
  hardMode: false,
  hardModeStreak: 0,
  ready: false,
  setHardMode: async () => {},
  refresh: async () => {},
});

export function HardModeProvider({ children }: { children: ReactNode }) {
  const [hardMode, setHardModeState] = useState(false);
  const [hardModeStreak, setHardModeStreak] = useState(0);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const [h, s] = await Promise.all([getHardMode(), getHardModeStreak()]);
    setHardModeState(h);
    setHardModeStreak(s);
    setReady(true);
  }, []);

  useEffect(() => {
    return subscribeAuth((user) => {
      if (!user) {
        setHardModeState(false);
        setHardModeStreak(0);
        setReady(true);
        return;
      }
      void refresh().catch(() => setReady(true));
    });
  }, [refresh]);

  const setHardMode = useCallback(
    async (enabled: boolean) => {
      setHardModeState(enabled);
      try {
        await persistHardMode(enabled);
        await refresh();
        await rescheduleSmartNotifications();
      } catch {
        /* not signed in */
      }
    },
    [refresh],
  );

  return (
    <HardModeContext.Provider
      value={{ hardMode, hardModeStreak, ready, setHardMode, refresh }}
    >
      {children}
    </HardModeContext.Provider>
  );
}

export function useHardMode() {
  return useContext(HardModeContext);
}
