// sync — typed window boundary. All runtime global accesses go through
// sw() so the rest of the code never touches `window as any`.
// Mirrors the pattern established in modules-window.ts / gematria-window.ts.
import type { CodexSyncApi } from "./types.js";

// ── Minimal Firebase compat SDK slice ─────────────────────────────────────────
// Only the methods actually consumed by the sync Firebase path.

export interface FirestoreDocSnap {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

export interface FirestoreDocRef {
  collection(path: string): FirestoreCollectionRef;
  get(): Promise<FirestoreDocSnap>;
  set(data: unknown, opts?: { merge?: boolean }): Promise<void>;
  onSnapshot(cb: (snap: FirestoreDocSnap) => void): () => void;
}

export interface FirestoreCollectionRef {
  doc(id: string): FirestoreDocRef;
}

export interface FirebaseFirestoreCompat {
  collection(path: string): FirestoreCollectionRef;
}

export interface FirebaseAuthCompat {
  onAuthStateChanged(cb: (user: unknown) => void): void;
  signInWithPopup(provider: unknown): Promise<unknown>;
  signOut(): Promise<void>;
}

/**
 * firebase.auth is both a callable (returns the auth instance) AND has a
 * GoogleAuthProvider constructor on it, matching Firebase compat SDK shape.
 */
export interface FirebaseAuthCtorCompat {
  (): FirebaseAuthCompat;
  GoogleAuthProvider: new () => unknown;
}

export interface FirebaseAppInstance {
  [key: string]: unknown;
}

export interface FirebaseCompat {
  auth: FirebaseAuthCtorCompat;
  firestore(): FirebaseFirestoreCompat;
  initializeApp(config: unknown): FirebaseAppInstance;
}

// ── Window globals this module SETS ──────────────────────────────────────────
// ── Window globals this module READS ─────────────────────────────────────────
//   localStorage  — standard DOM
//   fetch         — standard DOM
//   document      — standard DOM (dynamic <script> injection for Firebase SDK)
//   window.firebase — Firebase compat SDK (optional; lazy-loaded on demand)
export interface SyncWindow {
  CODEX_SYNC?: CodexSyncApi;
  firebase?: FirebaseCompat;
}

export function sw(): SyncWindow {
  return window as unknown as SyncWindow;
}
