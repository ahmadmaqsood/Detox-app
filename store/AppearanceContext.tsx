import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Storage from "expo-sqlite/kv-store";

export type ColorScheme = "light" | "dark";

const STORAGE_KEY = "@detox_appearance";

interface AppearanceContextValue {
  scheme: ColorScheme;
  setScheme: (s: ColorScheme) => void;
  toggleScheme: () => void;
  ready: boolean;
}

const AppearanceContext = createContext<AppearanceContextValue>({
  scheme: "dark",
  setScheme: () => {},
  toggleScheme: () => {},
  ready: false,
});

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await Storage.getItem(STORAGE_KEY);
        if (!cancelled && (saved === "light" || saved === "dark")) {
          setSchemeState(saved);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setScheme = useCallback((s: ColorScheme) => {
    setSchemeState(s);
    void Storage.setItem(STORAGE_KEY, s);
  }, []);

  const toggleScheme = useCallback(() => {
    setSchemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      void Storage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ scheme, setScheme, toggleScheme, ready }),
    [scheme, setScheme, toggleScheme, ready],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  return useContext(AppearanceContext);
}
