// sync — entry. Assigns window.CODEX_SYNC at import time, exactly as
// legacy/sync.js. Replaces that IIFE in the Vite build (gen-web-entry maps it).
import {
  on,
  isSyncable,
  getBackend,
  getAuto,
  setAuto,
  getLast,
  ghToken,
  ghGistId,
  ghGetLink,
  ghConnect,
  ghDisconnect,
  fbGetConfig,
  fbSetConfig,
  fbClearConfig,
  fbInit,
  fbSignIn,
  fbSignOut,
  pull,
  push,
  getSyncUser,
  installWatcher,
  runAutoInit,
} from "./helpers.js";
import { sw } from "./sync-window.js";
import type { CodexSyncApi } from "./types.js";

const API: CodexSyncApi = {
  on,
  isSyncable,
  getBackend,
  getAuto,
  setAuto,
  getLast,

  github: {
    connect: ghConnect,
    disconnect: ghDisconnect,
    getToken: ghToken,
    getGistId: ghGistId,
    getLink: ghGetLink,
  },

  firebase: {
    getConfig: fbGetConfig,
    setConfig: fbSetConfig,
    clearConfig: fbClearConfig,
    init: fbInit,
    signIn: fbSignIn,
    signOut: fbSignOut,
  },

  pullOnce: pull,
  pushNow: push,

  get user() {
    return getSyncUser();
  },
};

if (typeof window !== "undefined") {
  // Install the localStorage.setItem monkey-patch and cross-tab listener
  installWatcher();
  // Restore signed-in state / kick off Firebase on reload
  runAutoInit();
  sw().CODEX_SYNC = API;
}

export {
  on,
  isSyncable,
  getBackend,
  getAuto,
  setAuto,
  getLast,
  pull,
  push,
  ghConnect,
  ghDisconnect,
  ghToken,
  ghGistId,
  fbGetConfig,
  fbSetConfig,
  fbClearConfig,
  fbInit,
  fbSignIn,
  fbSignOut,
};
export type { CodexSyncApi, SyncBackend, SyncUser, SyncLastRecord, SyncEntry, SyncPayload } from "./types.js";
