// panels — formatting helpers (Backlog 4.1, panels feature). Pure; extracted
// from panels.jsx. humanAgo takes an injectable clock so it's deterministic.

export function ordinalWord(n: number): string {
  return (
    ["zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"][n] ||
    `${n}th`
  );
}

export function humanAgo(ts: number, now: number = Date.now()): string {
  if (!ts) return "";
  const diff = (now - ts) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  const d = new Date(ts);
  return `${d.getFullYear()}·${String(d.getMonth() + 1).padStart(2, "0")}·${String(d.getDate()).padStart(2, "0")}`;
}
