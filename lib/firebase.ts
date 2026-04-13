import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { Platform } from "react-native";

type FirebaseWebConfig = {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
};

function getFirebaseConfig(): FirebaseWebConfig | null {
  const extra: any =
    (Constants.expoConfig as any)?.extra ??
    (Constants.manifest as any)?.extra ??
    {};
  const cfg = extra?.firebase?.webConfig;
  if (!cfg?.apiKey || !cfg?.projectId || !cfg?.appId) return null;
  return cfg as FirebaseWebConfig;
}

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(getFirebaseConfig());
}

export function getFirebaseApp(): FirebaseApp | null {
  if (_app) return _app;
  const cfg = getFirebaseConfig();
  if (!cfg) return null;
  _app = getApps().length ? getApps()[0] : initializeApp(cfg);
  return _app;
}

function initAuth(app: FirebaseApp): Auth {
  if (Platform.OS === "web") {
    return getAuth(app);
  }
  // Metro resolves `firebase/auth` to the RN implementation; `getReactNativePersistence` exists
  // at runtime but is omitted from the umbrella TypeScript export.
  const nativeMod = require("firebase/auth") as {
    initializeAuth: typeof initializeAuth;
    getAuth: typeof getAuth;
    getReactNativePersistence: (storage: typeof AsyncStorage) => import("firebase/auth").Persistence;
  };
  try {
    return nativeMod.initializeAuth(app, {
      persistence: nativeMod.getReactNativePersistence(AsyncStorage),
    });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "auth/already-initialized") {
      return nativeMod.getAuth(app);
    }
    throw e;
  }
}

export function getFirebaseAuth(): Auth | null {
  if (_auth) return _auth;
  const app = getFirebaseApp();
  if (!app) return null;
  _auth = initAuth(app);
  return _auth;
}

export function getFirestoreDb(): Firestore | null {
  if (_db) return _db;
  const app = getFirebaseApp();
  if (!app) return null;
  _db = getFirestore(app);
  return _db;
}

export function getCurrentFirebaseUser(): User | null {
  return getFirebaseAuth()?.currentUser ?? null;
}

export function subscribeAuth(
  callback: (user: User | null) => void,
): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function signInWithEmail(email: string, password: string) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase Auth unavailable.");
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signUpWithEmail(email: string, password: string) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase Auth unavailable.");
  return createUserWithEmailAndPassword(auth, email.trim(), password);
}

export async function signOutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
}

export async function sendPasswordReset(email: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase Auth unavailable.");
  await sendPasswordResetEmail(auth, email.trim());
}
