// CODEX Plugins — registry logic (faithful port from legacy/plugins.js).
// All quirks, edge-cases and special-case handling are preserved exactly
// (comments mark non-obvious ones).
import type { Plugin, ResolvedPanel, ResolvedVerseAction } from "./types.js";
import { pw } from "./plugins-window.js";

// ── Canonical registry ────────────────────────────────────────────────────────
// Module-level Map so all consumers of this module share the same store.
// Exported so tests can reset state between runs.
export const registry: Map<string, Plugin> = new Map();

// ── Internal utilities ────────────────────────────────────────────────────────
export function isStr(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

export function validate(plugin: unknown): true {
  if (!plugin || typeof plugin !== "object") {
    throw new Error("CODEX plugin: must be an object");
  }
  const p = plugin as Record<string, unknown>;
  // Capture locals so narrowing holds for the error template strings below.
  const id      = p["id"];
  const name    = p["name"];
  const version = p["version"];
  if (!isStr(id))      throw new Error("CODEX plugin: missing `id`");
  if (!isStr(name))    throw new Error("CODEX plugin: missing `name`");
  if (!isStr(version)) throw new Error("CODEX plugin: missing `version`");
  // NOTE: preserved from legacy — `plugin.panels &&` (truthy) guard; a falsy
  // value (undefined/null/0/false) silently passes, only non-array truthy throws.
  const panels       = p["panels"];
  const verseActions = p["verseActions"];
  if (panels && !Array.isArray(panels)) {
    throw new Error(`CODEX plugin ${id}: panels must be an array`);
  }
  if (verseActions && !Array.isArray(verseActions)) {
    throw new Error(`CODEX plugin ${id}: verseActions must be an array`);
  }
  return true;
}

export function dispatch(eventName: string, detail: unknown): void {
  try { window.dispatchEvent(new CustomEvent(eventName, { detail })); }
  catch (e) { console.warn("CODEX plugins: dispatch failed", eventName, e); }
}

export function register(plugin: unknown): boolean {
  try { validate(plugin); }
  catch (e) {
    console.warn((e as Error).message);
    return false;
  }

  // validate() passed — safe to treat as Plugin.
  const p = plugin as Plugin;

  if (registry.has(p.id)) {
    console.warn(`CODEX plugin: duplicate id "${p.id}" — skipping`);
    return false;
  }
  registry.set(p.id, p);
  // Keep the public array in sync so consumers can iterate either source.
  const arr = pw().CODEX_PLUGINS;
  if (arr && !arr.includes(p)) arr.push(p);
  dispatch("codex:plugin-registered", { plugin: p });
  return true;
}

export function list(): Plugin[] {
  return Array.from(registry.values());
}

export function getPanels(): ResolvedPanel[] {
  const out: ResolvedPanel[] = [];
  for (const p of registry.values()) {
    if (!Array.isArray(p.panels)) continue;
    for (const panel of p.panels) {
      if (!panel || !isStr(panel.id) || typeof panel.render !== "function") continue;
      out.push({
        pluginId: p.id,
        id: panel.id,
        // NOTE: preserved from legacy — `||` (not `??`): empty string falls back to id.
        label: panel.label || panel.id,
        glyph: panel.glyph || "◆",
        render: panel.render,
      });
    }
  }
  return out;
}

export function getVerseActions(): ResolvedVerseAction[] {
  const out: ResolvedVerseAction[] = [];
  for (const p of registry.values()) {
    if (!Array.isArray(p.verseActions)) continue;
    for (const a of p.verseActions) {
      if (!a || typeof a.handler !== "function" || !isStr(a.label)) continue;
      out.push({
        pluginId: p.id,
        label: a.label,
        // NOTE: preserved from legacy — `||` (not `??`): empty string falls back to "◆".
        icon: a.icon || "◆",
        handler: a.handler,
      });
    }
  }
  return out;
}

// NOTE: preserved from legacy — fn.apply(null, args) so `this` is null inside
// the hook, matching the IIFE's original calling convention.
export function safeCall(
  fn: (...args: unknown[]) => unknown,
  args: unknown[],
  label: string,
): unknown {
  try { return fn.apply(null, args); }
  catch (e) { console.warn(`CODEX plugin: ${label} threw`, e); }
}

export function onNavigate(book: string, chapter: string): void {
  for (const p of registry.values()) {
    if (typeof p.onNavigate === "function") {
      safeCall(
        p.onNavigate as (...args: unknown[]) => unknown,
        [book, chapter],
        `${p.id}.onNavigate`,
      );
    }
  }
}

export function onVerseSelect(ref: unknown): void {
  for (const p of registry.values()) {
    if (typeof p.onVerseSelect === "function") {
      safeCall(
        p.onVerseSelect as (...args: unknown[]) => unknown,
        [ref],
        `${p.id}.onVerseSelect`,
      );
    }
  }
}

// Drain any entries pushed into CODEX_PLUGINS before the API loaded.
// NOTE: preserved from legacy — slice() snapshots the array so push() inside
// register() does not cause re-entrant iteration.
export function adoptPreRegistered(): void {
  const arr = pw().CODEX_PLUGINS;
  if (!arr) return;
  const pending = arr.slice();
  for (const p of pending) {
    if (p.id && !registry.has(p.id)) register(p);
  }
}
