// reader — migrated feature entry (Backlog 4.2). Replaces dist/components.js in
// the Vite build (gen-web-entry maps it). Re-exposes the same window globals the
// legacy components.jsx did so app.jsx / panels / mobile keep rendering them: the
// React hook shortcuts, the time/format helpers, the visual primitives, and the
// three shells (StatusBar, LeftRail, Reader). NormieToggle is published for
// panels.jsx to reuse.
import React from "react";
import { CornerFrame, Pill, Tick } from "./chrome.js";
import { useSolarClock } from "./useSolarClock.js";
import { pad, fmtClock, fmtDate } from "./solar.js";
import { StatusBar } from "./StatusBar.js";
import { LeftRail } from "./LeftRail.js";
import { Reader } from "./Reader.js";
import { NormieToggle } from "./NormieToggle.js";

const { useState, useEffect, useMemo, useRef, useCallback } = React;

Object.assign(window, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useSolarClock,
  fmtClock,
  fmtDate,
  pad,
  CornerFrame,
  Pill,
  Tick,
  StatusBar,
  LeftRail,
  Reader,
});

// Expose so other modules (panels.jsx) can use it without re-import.
(window as unknown as { CODEX_NormieToggle?: typeof NormieToggle }).CODEX_NormieToggle = NormieToggle;

// ── reader (soul) — migrated from legacy/reader.jsx (the sys-reader plugin,
// dist/reader.js). The Vite build maps BOTH dist/components.js and dist/reader.js
// to ./components/reader/index.js; ES-module dedup runs this entry once, so it
// must carry the soul's globals + load-time side-effects too. We set the EXACT
// window globals reader.jsx set and replicate its side-effects in source order:
// window.CODEX_DIVINE, CSS inject, boot-ref, plugin register, the component
// re-exports. (Sub-modules are pulled into the graph via these imports.)
import { cxrInjectSoulCss } from "./soul-style.js";
import { cxrDivineSegment, CXR_DIVINE_RULES } from "./divine.js";
import { CodexReaderX } from "./CodexReaderX.js";
import { CxrSpawn } from "./CxrSpawn.js";
import { registerReaderPlugin, readerBootRef } from "./register.js";
import type { SoulWindow } from "./soul-window.js";

// The immortal engine handle — callable without any DOM.
(window as unknown as SoulWindow).CODEX_DIVINE = { segment: cxrDivineSegment, rules: CXR_DIVINE_RULES };

cxrInjectSoulCss();

readerBootRef();
registerReaderPlugin();

Object.assign(window, { CodexReaderX, CxrSpawn });
