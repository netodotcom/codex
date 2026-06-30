// artifacts — THE RENDERER (migrated VERBATIM from artifacts.jsx). One renderer
// for every AI surface: model text in, REAL DOM out. Markdown-ish rich text plus
// the typed directives, parsed by hand and built as React elements. CSS is
// self-injected on mount (idempotent).
import React from "react";
import { artEnsureCss } from "./style.js";
import { artParseBlocks } from "./blocks.js";
import { artRenderInline } from "./inline.js";
import { artRenderFence } from "./directives.js";

const { useEffect, useMemo } = React;

export function ArtifactsRich({ text }: { text: string }): React.ReactElement {
  useEffect(() => {
    artEnsureCss();
  }, []);
  const blocks = useMemo(() => artParseBlocks(text), [text]);
  return (
    <div className="cx-art">
      {blocks.map((b, i) => {
        if (b.type === "fence") return artRenderFence(b, i);
        if (b.type === "h")
          return (
            <div key={i} role="heading" aria-level={Math.min(b.level + 2, 6)} className={`cx-art-h is-${Math.min(b.level, 4)}`}>
              {artRenderInline(b.text)}
            </div>
          );
        if (b.type === "hr") return <hr key={i} />;
        if (b.type === "quote") return <blockquote key={i}>{artRenderInline(b.text)}</blockquote>;
        if (b.type === "list") {
          const Tag = b.ordered ? "ol" : "ul";
          return (
            <Tag key={i}>
              {b.items.map((it, j) => (
                <li key={j}>{artRenderInline(it)}</li>
              ))}
            </Tag>
          );
        }
        if (b.type === "table") {
          return (
            <table key={i} className="cx-art-table">
              <thead>
                <tr>
                  {b.head.map((h, j) => (
                    <th key={j}>{artRenderInline(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j}>
                    {r.map((c, k) => (
                      <td key={k}>{artRenderInline(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        return <p key={i}>{artRenderInline(b.text)}</p>;
      })}
    </div>
  );
}
