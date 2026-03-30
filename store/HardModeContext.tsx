import {
  getHardMode,
  getHardModeStreak,
  setHardMode as persistHardMode,
} from "@/lib/database";
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
    void refresh();
  }, [refresh]);

  const setHardMode = useCallback(
    async (enabled: boolean) => {
      setHardModeState(enabled);
      await persistHardMode(enabled);
      await refresh();
      await rescheduleSmartNotifications();
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
