// panels — GematriaDeep + GematriaKabbalah + KabTree (Backlog 4.1). Migrated from
// panels.jsx (l.1071). The schema-2 deep block: all numerological systems for
// the primary word (computed via @codex/core), canon + library cross-matches,
// notarikon/temurah/rabbinic sources, AI synthesis and the kabbalah compartment.
import React, { useEffect, useMemo, useState } from "react";
import { all as gematriaAll, english as gematriaEnglish, type GematriaLang } from "@codex/core/gematria";
import { Collapsible } from "./chrome.js";
import { clickableProps } from "./util.js";
import { GemValueModal, useKabbalahMap } from "./GemValueModal.js";
import type { GemServices, GemMatch, KabMap, KabSefirah } from "./gem-services.js";

export interface GematriaDeepData {
  primary_word?: string;
  primary_lang?: GematriaLang;
  primary_translit?: string;
  primary_gloss?: string;
  symbolic_meaning?: string;
  ai_insight?: string;
  cross_matches?: Array<{ value?: number | string; via_system?: string; matches?: Array<{ ref?: string; word?: string; note?: string }> }>;
  notarikon?: Array<{ phrase?: string; expansion?: string }>;
  temurah?: Array<{ transform?: string; result?: string; note?: string }>;
  rabbinic_sources?: Array<{ name?: string; quote?: string }>;
  kabbalah?: {
    sefirot_resonances?: Array<{ sefirah?: string; note?: string; value?: number }>;
    lurianic_frame?: string;
    lurianic_note?: string;
    partzuf?: string;
    partzuf_note?: string;
    zohar_citations?: Array<{ ref?: string; text?: string }>;
  };
  _schema?: number;
}

const SYSTEM_HELP: Record<string, string> = {
  hechrachi: "Mispar Hechrachi — standard absolute value (א=1, י=10, ק=100, ת=400)",
  gadol: "Mispar Gadol — finals lifted (ך=500, ם=600, ן=700, ף=800, ץ=900)",
  sidduri: "Mispar Sidduri — ordinal position (1–22)",
  katan: "Mispar Katan — each letter reduced to a single digit then summed",
  katan_mispari: "Mispar Katan Mispari — sum reduced to a single digit (digital root)",
  boneh: "Mispar Bone'eh — 'building' / cumulative running sum",
  kidmi: "Mispar Kidmi — each letter's triangular value",
  atbash: "Atbash — first↔last letter substitution cipher",
  albam: "Albam — alphabet split in half, halves swapped",
  neelam: "Mispar Ne'elam — value of the spelled-out letter NAME minus the letter itself",
  haakhor: "Mispar Ha'akhor — each letter's value multiplied by its position",
  isopsephy: "Greek isopsephy — α=1 … ω=800 (classical)",
  ordinal: "Greek ordinal — letter position 1..24",
  reduced: "Greek reduced — sum reduced to a single digit",
  reduction: "English reduction — each letter reduced to 1..9",
  reverse: "English reverse — z=1 … a=26",
};

function isTransform(v: unknown): v is { transformed: string; value: number } {
  return !!v && typeof v === "object" && "value" in v;
}

function KabTree({ sefirot, highlight, onPick }: { sefirot: KabSefirah[]; highlight: string[]; onPick: (s: KabSefirah) => void }): React.ReactElement {
  const POS: Record<string, [number, number]> = {
    Keter: [50, 8],
    Chokhmah: [80, 24],
    Binah: [20, 24],
    Chesed: [80, 52],
    Gevurah: [20, 52],
    Tiferet: [50, 68],
    Netzach: [80, 92],
    Hod: [20, 92],
    Yesod: [50, 108],
    Malkhut: [50, 132],
  };
  const lit = new Set(highlight);
  return (
    <svg className="cx-gem-kab-tree" viewBox="0 0 100 144" aria-label="Tree of Life">
      {sefirot.map((s) => {
        const [cx, cy] = POS[s.translit] || [50, 70];
        const on = lit.has(s.translit);
        return (
          <g key={s.translit} onClick={() => onPick(s)} style={{ cursor: "pointer" }}>
            <circle
              cx={cx}
              cy={cy}
              r={on ? 7 : 5}
              fill={on ? s.color || "var(--cx-accent)" : "none"}
              stroke={on ? "var(--cx-fg)" : "var(--cx-fg-dim, #888)"}
              strokeWidth={on ? 1.2 : 0.8}
              opacity={on ? 1 : 0.55}
            />
            <text x={cx} y={cy + 2} fontSize="3.2" textAnchor="middle" fill={on ? "var(--cx-bg)" : "var(--cx-fg-dim, #888)"}>
              {s.n}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

type ResultMap = Record<string, unknown>;

function GematriaKabbalah({
  deep,
  values,
  canonicalValue,
  kabMap,
  onOpenValue,
}: {
  deep: GematriaDeepData;
  values: ResultMap | null;
  canonicalValue: number | null;
  kabMap: KabMap | null;
  onOpenValue: (v: number) => void;
}): React.ReactElement | null {
  const [activeSefirah, setActiveSefirah] = useState<KabSefirah | null>(null);

  const numericValues = useMemo(() => {
    const set = new Set<number>();
    if (canonicalValue) set.add(canonicalValue);
    if (values) {
      for (const [k, v] of Object.entries(values)) {
        if (k === "lang") continue;
        if (typeof v === "number" && Number.isFinite(v)) set.add(v);
        else if (isTransform(v) && Number.isFinite(v.value)) set.add(v.value);
      }
    }
    (deep.cross_matches || []).forEach((cm) => {
      const n = Number(cm.value);
      if (Number.isFinite(n)) set.add(n);
    });
    return set;
  }, [canonicalValue, values, deep.cross_matches]);

  if (!kabMap) return null;

  const autoSefirot = (kabMap.sefirot || []).filter((s) => numericValues.has(s.value));
  const autoConcepts: Array<{ value: number; category: string; concept: string }> = [];
  for (const v of numericValues) {
    const c = kabMap.value_to_concept?.[String(v)];
    if (c) autoConcepts.push({ value: v, category: c.category, concept: c.concept });
  }
  type ShownSefirah = KabSefirah & { note?: string };
  const aiSefirot: ShownSefirah[] = [];
  for (const r of deep.kabbalah?.sefirot_resonances || []) {
    const s = (kabMap.sefirot || []).find((x) => x.translit?.toLowerCase() === (r.sefirah || "").toLowerCase());
    if (s) aiSefirot.push({ ...s, note: r.note });
  }

  const sefirotShown: ShownSefirah[] = [];
  const seen = new Set<string>();
  for (const s of [...aiSefirot, ...autoSefirot]) {
    if (seen.has(s.translit)) continue;
    seen.add(s.translit);
    sefirotShown.push(s);
  }

  const frame = deep.kabbalah?.lurianic_frame;
  const luri = frame ? kabMap.concepts?.[frame] : undefined;
  const partzufName = deep.kabbalah?.partzuf;
  const partzuf = partzufName ? (kabMap.partzufim || []).find((p) => p.name === partzufName || p.translit === partzufName) : undefined;
  const zoharCites = deep.kabbalah?.zohar_citations || [];

  if (!sefirotShown.length && !autoConcepts.length && !luri && !partzuf && !zoharCites.length) return null;

  const subParts: string[] = [];
  if (sefirotShown.length) subParts.push(`${sefirotShown.length} sefirah`);
  if (autoConcepts.length) subParts.push(`${autoConcepts.length} echo`);
  if (luri) subParts.push("lurianic");
  if (partzuf) subParts.push("partzuf");

  return (
    <section className="cx-gem-kab">
      <Collapsible defaultOpen={false} title={<span className="cx-gem-kab-title">⟁ KABBALAH · HIDDEN COMPARTMENT</span>} sub={subParts.join(" · ")}>
        {sefirotShown.length ? (
          <div className="cx-gem-kab-block">
            <h4>SEFIROT RESONANCE</h4>
            <KabTree sefirot={kabMap.sefirot || []} highlight={sefirotShown.map((s) => s.translit)} onPick={(s) => setActiveSefirah(s)} />
            <div className="cx-gem-kab-sefirot">
              {sefirotShown.map((s) => (
                <button
                  key={s.translit}
                  className={`cx-gem-kab-card ${activeSefirah?.translit === s.translit ? "is-on" : ""}`}
                  style={{ borderColor: s.color || "var(--cx-accent)" }}
                  onClick={() => setActiveSefirah(s)}
                >
                  <span className="cx-gem-kab-heb" dir="rtl">
                    {s.name}
                  </span>
                  <span className="cx-gem-kab-tr">{s.translit}</span>
                  <span className="cx-gem-kab-mean">{s.meaning}</span>
                  <span className="cx-gem-kab-val cx-gem-clickable" {...clickableProps(() => onOpenValue(s.value), `Open value ${s.value}`)}>
                    {s.value}
                  </span>
                  {s.note ? <span className="cx-gem-kab-note">— {s.note}</span> : null}
                </button>
              ))}
            </div>
            {activeSefirah ? (
              <div className="cx-gem-kab-detail">
                <p>
                  <b>{activeSefirah.translit}</b> · {activeSefirah.meaning}
                  {activeSefirah.world ? ` · ${activeSefirah.world}` : ""}
                </p>
                {activeSefirah.body ? <p className="cx-gem-kab-detail-body">{activeSefirah.body}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {autoConcepts.length ? (
          <div className="cx-gem-kab-block">
            <h4>CONCEPT ECHOES</h4>
            <ul className="cx-gem-kab-echoes">
              {autoConcepts.map((c, i) => (
                <li key={i}>
                  <button className="cx-gem-kab-echo-val cx-gem-clickable" {...clickableProps(() => onOpenValue(c.value), `Open value ${c.value}`)}>
                    {c.value}
                  </button>
                  <span className="cx-gem-kab-echo-cat">{c.category}</span>
                  <span className="cx-gem-kab-echo-txt">— {c.concept}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {luri ? (
          <div className="cx-gem-kab-block">
            <h4>LURIANIC FRAME</h4>
            <div className="cx-gem-kab-luri">
              <div className="cx-gem-kab-luri-name">
                <b>{luri.name}</b> <span dir="rtl">{luri.hebrew}</span>
              </div>
              <p>{luri.meaning}</p>
              {deep.kabbalah?.lurianic_note ? <p className="cx-gem-kab-luri-ai">▹ {deep.kabbalah.lurianic_note}</p> : null}
              <span className="cx-gem-kab-src">{luri.source}</span>
            </div>
          </div>
        ) : null}

        {partzuf ? (
          <div className="cx-gem-kab-block">
            <h4>PARTZUF</h4>
            <div className="cx-gem-kab-partzuf">
              <b>{partzuf.name}</b> — <i>{partzuf.translit}</i>
              <span className="cx-gem-kab-src">
                linked to {partzuf.sefirah} · {partzuf.polarity}
              </span>
              {deep.kabbalah?.partzuf_note ? <p>▹ {deep.kabbalah.partzuf_note}</p> : null}
            </div>
          </div>
        ) : null}

        {zoharCites.length ? (
          <div className="cx-gem-kab-block">
            <h4>ZOHAR CITATIONS</h4>
            {zoharCites.map((z, i) => (
              <div key={i} className="cx-gem-kab-zohar">
                <div className="cx-gem-kab-zohar-ref">{z.ref}</div>
                <p className="cx-gem-quote">“{z.text}”</p>
              </div>
            ))}
          </div>
        ) : null}
      </Collapsible>
    </section>
  );
}

export function GematriaDeep({ deep, services }: { deep: GematriaDeepData; services: GemServices }): React.ReactElement {
  const kabMap = useKabbalahMap(services);
  const [modalValue, setModalValue] = useState<number | null>(null);
  const openValue = (v: number): void => {
    if (v && Number.isFinite(v)) setModalValue(v);
  };

  const values = useMemo<ResultMap | null>(() => {
    if (!deep.primary_word) return null;
    try {
      return gematriaAll(deep.primary_word, deep.primary_lang) as unknown as ResultMap;
    } catch {
      return null;
    }
  }, [deep.primary_word, deep.primary_lang]);

  const canonicalValue = useMemo<number | null>(() => {
    if (!values) return null;
    if (values["lang"] === "hebrew") return values["hechrachi"] as number;
    if (values["lang"] === "greek") return values["isopsephy"] as number;
    return (values["ordinal"] as number) ?? null;
  }, [values]);
  const canonicalSystem = values?.["lang"] === "hebrew" ? "hechrachi" : values?.["lang"] === "greek" ? "isopsephy" : "en_ordinal";

  const [libMatches, setLibMatches] = useState<GemMatch[] | null>(null);
  const [libBuilding, setLibBuilding] = useState(false);
  const [libTab, setLibTab] = useState<"canon" | "library">("canon");

  useEffect(() => {
    const IDX = services.index;
    if (!IDX || !canonicalValue) return;
    let alive = true;
    void (async () => {
      setLibBuilding(true);
      try {
        await IDX.ensure();
        if (!alive) return;
        setLibMatches(IDX.find(canonicalValue, { system: canonicalSystem }));
      } catch {
        setLibMatches([]);
      } finally {
        if (alive) setLibBuilding(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [canonicalValue, canonicalSystem, services]);

  const crossLang = useMemo<Record<string, number> | null>(() => {
    if (!deep.primary_word) return null;
    const out: Record<string, number> = {};
    if (values?.["lang"] === "hebrew") out["HEBREW"] = values["hechrachi"] as number;
    if (values?.["lang"] === "greek") out["GREEK"] = values["isopsephy"] as number;
    if (deep.primary_translit) {
      try {
        out["ENGLISH"] = gematriaEnglish.ordinal(deep.primary_translit);
      } catch {
        /* ignore */
      }
    }
    return Object.keys(out).length ? out : null;
  }, [values, deep.primary_translit, deep.primary_word]);

  const jump = (ref: string): void => services.jumpRef(ref);

  return (
    <>
      {deep.primary_word ? (
        <Collapsible defaultOpen title="PRIMARY WORD · FOCUS">
          <div className="cx-gem-focus">
            <div
              className="cx-gem-focus-word cx-gem-clickable"
              dir="auto"
              {...clickableProps(() => services.openStrongs(deep.primary_word || ""), `Open Strong's for ${deep.primary_word}`)}
              title="Open Strong's entry"
            >
              {deep.primary_word}
            </div>
            <div className="cx-gem-focus-meta">
              {deep.primary_translit ? <span className="cx-gem-focus-tr">{deep.primary_translit}</span> : null}
              {deep.primary_gloss ? <span className="cx-gem-focus-gl">— {deep.primary_gloss}</span> : null}
            </div>
            {canonicalValue ? (
              <div className="cx-gem-focus-val cx-gem-clickable" {...clickableProps(() => openValue(canonicalValue), `Open value ${canonicalValue}`)} title={`See every verse summing to ${canonicalValue}`}>
                <b>{canonicalValue}</b>
                <i>{canonicalSystem.toUpperCase()}</i>
              </div>
            ) : null}
            {deep.symbolic_meaning ? <p className="cx-gem-focus-sym">{deep.symbolic_meaning}</p> : null}
          </div>
        </Collapsible>
      ) : null}

      {crossLang ? (
        <div className="cx-gem-crosslang">
          {Object.entries(crossLang).map(([k, v]) => (
            <span key={k} className="cx-gem-clickable" {...clickableProps(() => openValue(v), `Open value ${v}`)}>
              <i>{k}</i>
              <b>{v}</b>
            </span>
          ))}
        </div>
      ) : null}

      {values ? (
        <Collapsible title="ALL NUMEROLOGICAL SYSTEMS" sub={`Computed offline · ${String(values["lang"])}`}>
          <div className="cx-gem-sys-grid">
            {Object.entries(values)
              .filter(([k]) => k !== "lang")
              .map(([k, v]) => {
                const numericVal = isTransform(v) ? v.value : typeof v === "number" && Number.isFinite(v) ? v : null;
                const display = isTransform(v) ? `${v.transformed} · ${v.value}` : String(v);
                const canClick = numericVal != null && numericVal > 1;
                return (
                  <div
                    key={k}
                    className={`cx-gem-sys-row ${canClick ? "cx-gem-clickable" : ""}`}
                    title={SYSTEM_HELP[k] || ""}
                    {...(canClick ? clickableProps(() => openValue(numericVal), `Open value ${numericVal}`) : {})}
                  >
                    <span className="cx-gem-sys-k">{k.replace(/_/g, " ")}</span>
                    <span className="cx-gem-sys-v">{display}</span>
                  </div>
                );
              })}
          </div>
        </Collapsible>
      ) : null}

      {deep.cross_matches?.length || libMatches?.length || libBuilding ? (
        <Collapsible defaultOpen title="CROSS-MATCHES · SAME VALUE" sub={`value: ${canonicalValue ?? "—"}`}>
          <div className="cx-gem-xtabs">
            <button className={`cx-gem-xtab ${libTab === "canon" ? "is-on" : ""}`} onClick={() => setLibTab("canon")}>
              FROM CANON ({(deep.cross_matches || []).reduce((n, c) => n + (c.matches?.length || 0), 0)})
            </button>
            <button className={`cx-gem-xtab ${libTab === "library" ? "is-on" : ""}`} onClick={() => setLibTab("library")}>
              FROM YOUR LIBRARY ({libBuilding ? "…" : libMatches?.length || 0})
            </button>
          </div>
          {libTab === "canon" ? (
            <div className="cx-gem-xlist">
              {(deep.cross_matches || []).map((cm, i) => (
                <div key={i} className="cx-gem-xgroup">
                  <div className="cx-gem-xgh">
                    <b className="cx-gem-clickable" {...clickableProps(() => openValue(Number(cm.value)), `Open value ${cm.value}`)} title={`See every verse summing to ${cm.value}`}>
                      {cm.value}
                    </b>{" "}
                    <i>via {cm.via_system}</i>
                  </div>
                  {(cm.matches || []).map((m, j) => (
                    <div key={j} className="cx-gem-xrow">
                      <span className="cx-gem-xref cx-gem-clickable" {...clickableProps(() => m.ref && jump(m.ref), `Jump to ${m.ref}`)}>
                        {m.ref}
                      </span>
                      {m.word ? (
                        <span className="cx-gem-xword cx-gem-clickable" dir="auto" {...clickableProps(() => services.openStrongs(m.word || ""), `Open Strong's for ${m.word}`)}>
                          {m.word}
                        </span>
                      ) : null}
                      {m.note ? <span className="cx-gem-xnote">— {m.note}</span> : null}
                    </div>
                  ))}
                </div>
              ))}
              {!(deep.cross_matches || []).length ? <p className="cx-gem-empty">No canonical matches surfaced.</p> : null}
            </div>
          ) : (
            <div className="cx-gem-xlist">
              {libBuilding ? (
                <p className="cx-gem-empty">⌬ Indexing your cached verses…</p>
              ) : libMatches && libMatches.length ? (
                libMatches.slice(0, 30).map((m, i) => (
                  <div key={i} className="cx-gem-xrow">
                    <span className="cx-gem-xref cx-gem-clickable" {...clickableProps(() => jump(m.ref), `Jump to ${m.ref}`)}>
                      {m.ref}
                    </span>
                    <span className="cx-gem-xword cx-gem-clickable" dir="auto" {...clickableProps(() => services.openStrongs(m.word), `Open Strong's for ${m.word}`)}>
                      {m.word}
                    </span>
                    <span className="cx-gem-xnote">— {m.system}</span>
                  </div>
                ))
              ) : (
                <p className="cx-gem-empty">No verses in your library share value {canonicalValue}. Read more chapters to grow the index.</p>
              )}
              {libMatches && libMatches.length > 30 ? <p className="cx-gem-empty">+{libMatches.length - 30} more matches in your library</p> : null}
            </div>
          )}
        </Collapsible>
      ) : null}

      {deep.notarikon?.length ? (
        <Collapsible title="NOTARIKON · ACRONYM READINGS" count={deep.notarikon.length}>
          {deep.notarikon.map((n, i) => (
            <div key={i} className="cx-gem-card">
              <div className="cx-gem-card-h" dir="auto">
                {n.phrase}
              </div>
              <p className="cx-gem-card-b">{n.expansion}</p>
            </div>
          ))}
        </Collapsible>
      ) : null}

      {deep.temurah?.length ? (
        <Collapsible title="TEMURAH · LETTER CIPHERS" count={deep.temurah.length}>
          {deep.temurah.map((t, i) => (
            <div key={i} className="cx-gem-card">
              <div className="cx-gem-card-h">
                <b>{t.transform}</b> → <span dir="auto">{t.result}</span>
              </div>
              {t.note ? <p className="cx-gem-card-b">{t.note}</p> : null}
            </div>
          ))}
        </Collapsible>
      ) : null}

      {deep.rabbinic_sources?.length ? (
        <Collapsible title="RABBINIC SOURCES" count={deep.rabbinic_sources.length}>
          {deep.rabbinic_sources.map((r, i) => (
            <div key={i} className="cx-gem-card">
              <div className="cx-gem-card-h">{r.name}</div>
              <p className="cx-gem-card-b cx-gem-quote">“{r.quote}”</p>
            </div>
          ))}
        </Collapsible>
      ) : null}

      {deep.ai_insight ? (
        <Collapsible defaultOpen title="AI SYNTHESIS">
          <div className="cx-gem-insight">
            <p>{deep.ai_insight}</p>
          </div>
        </Collapsible>
      ) : null}

      <GematriaKabbalah deep={deep} values={values} canonicalValue={canonicalValue} kabMap={kabMap} onOpenValue={openValue} />

      {modalValue ? (
        <GemValueModal value={modalValue} system={canonicalSystem} kabMap={kabMap} services={services} onClose={() => setModalValue(null)} onJump={jump} />
      ) : null}
    </>
  );
}
