import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { subscribeAuth } from '@/lib/firebase';
import { getMode, setMode as persistMode } from '@/lib/firestoreDatabase';
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
    return subscribeAuth((user) => {
      if (!user) {
        setModeState('hostel');
        setReady(true);
        return;
      }
      void getMode()
        .then((m) => {
          setModeState(m);
          setReady(true);
        })
        .catch(() => setReady(true));
    });
  }, []);

  const setMode = useCallback(async (m: Mode) => {
    setModeState(m);
    try {
      await persistMode(m);
    } catch {
      /* not signed in */
    }
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
