import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { getMode, setMode as persistMode } from '@/lib/database';
import type { Mode } from '@/lib/types';

interface ModeContextValue {
  mode: Mode;
  setMode: (m: Mode) => Promise<void>;
  ready: boolean;
}

const ModeContext = createContext<ModeContextValue>({
  mode: 'hostel',
  setMode: async () => {},
  ready: false,
});

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>('hostel');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getMode().then((m) => {
      setModeState(m);
      setReady(true);
    });
  }, []);

  const setMode = useCallback(async (m: Mode) => {
    setModeState(m);
    await persistMode(m);
  }, []);

  return (
    <ModeContext.Provider value={{ mode, setMode, ready }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  return useContext(ModeContext);
}
