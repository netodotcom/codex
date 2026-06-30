// artifacts — the grammar (migrated VERBATIM from artifacts.jsx). Single source
// of truth for the directive language, embedded in every system prompt that
// renders through the engine. Exposed as CODEX_ARTIFACTS.directiveDoc.

export function artDirectiveDoc(): string {
  return [
    "RICH OUTPUT — your replies render through the CODEX artifacts engine:",
    "· Markdown works: ## headings · **bold** · *italic* · `code` · - lists · > quotes · | tables | (with a |---| separator row) · --- rules.",
    "· Scripture references written PLAINLY (Book Chapter:Verse, e.g. John 1:1, Genesis 1:26-27) become live clickable chips that open the reader — never wrap a reference in brackets, code ticks, or [j]/[d] tags.",
    "· [j]exact Jesus quote[/j] renders red-letter; [d]exact God-the-Father quote[/d] renders with shimmer. Verbatim quotes only.",
    "· You may emit FENCED DIRECTIVE BLOCKS. Each becomes a real interactive element. The fence tag must be exact; the body must be VALID JSON; at most 2 directives per reply, and only when they genuinely serve the answer:",
    "```codex:buttons",
    '[{"label":"Read John 1","action":{"kind":"goto","ref":"John 1:1"}},',
    ' {"label":"Open gematria","action":{"kind":"panel","id":"gem"}},',
    ' {"label":"Map this verse","action":{"kind":"console","console":"map","ref":"John 1:1"}},',
    ' {"label":"Reader font 22","action":{"kind":"setting","key":"fontScale","value":22}}]',
    "```",
    'action kinds → "goto" {ref} · "panel" {id: one of trans|talmud|comm|gem|gnosis|disarm|exeg|txan|library|oracle|marks} · "console" {console: map|mirror|sword|art|compare, ref} · "setting" {key, value} (settings keys include fontScale, scriptureFont, accent, redLetter, sideBySide, distractionFree, primaryTranslation).',
    "```codex:chart",
    '{"type":"bar","title":"Logos occurrences","data":[{"label":"John","value":4},{"label":"1 John","value":1}]}',
    "```",
    'chart types → "bar" | "line" | "radial". Values must be REAL numbers you computed or sourced (tool results, counts you actually made) — NEVER decorative or invented data.',
    "```codex:flow",
    '{"nodes":[{"id":"a","label":"Word with God","ref":"John 1:1"},{"id":"b","label":"Word made flesh","ref":"John 1:14"}],"edges":[{"from":"a","to":"b","label":"becomes"}]}',
    "```",
    "```codex:verse-grid",
    '["John 1:1","Genesis 1:1","Colossians 1:16"]',
    "```",
    "verse-grid renders live scripture cards (use for parallel passages; 2-6 refs).",
  ].join("\n");
}
