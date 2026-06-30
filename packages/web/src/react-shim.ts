// Build-time React shim (Backlog 4.0).
//
// During the incremental TSX migration the app must share ONE React instance:
// the legacy CDN `window.React`. Migrated components `import React from "react"`;
// the Vite build/dev aliases "react" to this shim so they resolve to the global
// instead of a second bundled copy (which would break hooks/context). Tests do
// NOT alias — they run against the real npm react under jsdom.
import type * as ReactTypes from "react";

const R = (globalThis as unknown as { React?: typeof ReactTypes }).React;
if (!R) throw new Error("react-shim: window.React not found — the CDN React script must load first");

export default R;
export const {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useLayoutEffect,
  useContext,
  useReducer,
  useImperativeHandle,
  useId,
  createContext,
  createElement,
  cloneElement,
  isValidElement,
  Children,
  Fragment,
  memo,
  forwardRef,
  Component,
  StrictMode,
  Suspense,
  lazy,
} = R;
