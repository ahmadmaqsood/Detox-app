import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { getCurrentFirebaseUser, subscribeAuth } from "@/lib/firebase";
import {
  getFocusLockEnabled,
  setFocusLockEnabled as persistFocus,
  recordAppOpenEvent,
  getAppOpenCountSince,
} from "@/lib/firestoreDatabase";

const FOCUS_WINDOW_MS = 45 * 60 * 1000;
const OPEN_BURST_THRESHOLD = 6;

interface FocusContextValue {
  focusLock: boolean;
  frequentOpenWarning: boolean;
  dismissWarning: () => void;
  setFocusLock: (v: boolean) => Promise<void>;
  refreshFocusState: () => Promise<void>;
}

const FocusContext = createContext<FocusContextValue>({
  focusLock: false,
  frequentOpenWarning: false,
  dismissWarning: () => {},
  setFocusLock: async () => {},
  refreshFocusState: async () => {},
});

export function FocusProvider({ children }: { children: ReactNode }) {
  const [focusLock, setFocusLockState] = useState(false);
  const [frequentOpenWarning, setFrequentOpenWarning] = useState(false);
  const appState = useRef(AppState.currentState);
  const warnedAt = useRef(0);

  const checkBurst = useCallback(async () => {
    if (!getCurrentFirebaseUser()) {
      setFrequentOpenWarning(false);
      return;
    }
    if (!(await getFocusLockEnabled())) {
      setFrequentOpenWarning(false);
      return;
    }
    const since = new Date(Date.now() - FOCUS_WINDOW_MS).toISOString();
    const n = await getAppOpenCountSince(since);
    if (n >= OPEN_BURST_THRESHOLD) {
      const now = Date.now();
      if (now - warnedAt.current > 90_000) {
        warnedAt.current = now;
        setFrequentOpenWarning(true);
      }
    }
  }, []);

  const refreshFocusState = useCallback(async () => {
    if (!getCurrentFirebaseUser()) {
      setFocusLockState(false);
      setFrequentOpenWarning(false);
      return;
    }
    try {
      const on = await getFocusLockEnabled();
      setFocusLockState(on);
      if (!on) setFrequentOpenWarning(false);
    } catch {
      setFocusLockState(false);
      setFrequentOpenWarning(false);
    }
  }, []);

  const setFocusLock = useCallback(async (v: boolean) => {
    setFocusLockState(v);
    try {
      await persistFocus(v);
    } catch {
      /* not signed in */
    }
  }, []);

  const dismissWarning = useCallback(() => {
    setFrequentOpenWarning(false);
  }, []);

  useEffect(() => {
    return subscribeAuth(() => {
      void refreshFocusState();
    });
  }, [refreshFocusState]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
      const wasBg = /inactive|background/.test(appState.current ?? '');
      appState.current = next;
      if (wasBg && next === 'active') {
        if (!getCurrentFirebaseUser()) return;
        try {
          if (await getFocusLockEnabled()) {
            await recordAppOpenEvent();
            await checkBurst();
          }
        } catch {
          /* not signed in */
        }
      }
    });
    return () => sub.remove();
  }, [checkBurst]);

  return (
    <FocusContext.Provider
      value={{
        focusLock,
        frequentOpenWarning,
        dismissWarning,
        setFocusLock,
        refreshFocusState,
      }}
    >
      {children}
    </FocusContext.Provider>
  );
}

export function useFocusLock() {
  return useContext(FocusContext);
}
