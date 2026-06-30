// settings — the panel's self-injected CSS (migrated verbatim from
// tweaks-panel.jsx __TWEAKS_STYLE). Tokens only; rendered as a <style> element
// inside TweaksPanel so it lives and dies with the panel.
export const TWEAKS_STYLE = `
  /* ── shell ───────────────────────────────────────────────────────────── */
  .twkx-scrim{position:fixed;inset:0;z-index:2147483645;
    background:color-mix(in oklab, var(--cx-bg, #06080e) 62%, transparent);
    -webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);
    animation:twkx-in 160ms ease}
  .twkx-panel{position:fixed;z-index:2147483646;top:50%;left:50%;
    transform:translate(-50%,-50%);
    width:clamp(680px,72vw,1240px);height:clamp(540px,84dvh,1100px);
    max-width:96vw;max-height:94dvh;
    display:flex;flex-direction:column;overflow:hidden;
    background:var(--cx-bg,#06080e);color:var(--cx-fg,#c9d6e6);
    border:1px solid color-mix(in oklab, var(--cx-accent,#7ee0ff) 30%, transparent);
    border-radius:10px;
    box-shadow:0 32px 80px -20px rgba(0,0,0,.6),
      0 0 0 1px color-mix(in oklab, var(--cx-accent,#7ee0ff) 12%, transparent);
    font:12px/1.45 var(--cx-mono, ui-monospace, monospace);
    animation:twkx-pop 200ms cubic-bezier(.3,.7,.4,1)}
  @keyframes twkx-in{from{opacity:0}to{opacity:1}}
  @keyframes twkx-pop{from{opacity:0;transform:translate(-50%,-49%) scale(.99)}to{opacity:1;transform:translate(-50%,-50%)}}
  @media (prefers-reduced-motion: reduce){
    .twkx-scrim,.twkx-panel{animation:none}
    .twkx-panel *{transition:none !important;animation:none !important;scroll-behavior:auto !important}
  }

  .twkx-head{display:flex;align-items:center;gap:14px;flex:0 0 auto;
    padding:10px 10px 10px 18px;
    border-bottom:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 22%, transparent);
    background:color-mix(in oklab, var(--cx-accent,#7ee0ff) 5%, var(--cx-bg,#06080e))}
  .twkx-title{font-weight:700;font-size:11px;letter-spacing:.24em;text-transform:uppercase;
    color:var(--cx-fg,#c9d6e6);white-space:nowrap}
  .twkx-title::before{content:"⚙ ";color:var(--cx-accent,#7ee0ff)}
  .twkx-mode{display:flex;gap:2px;padding:2px;border-radius:6px;
    background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 10%, transparent)}
  .twkx-mode button{appearance:none;border:0;background:transparent;color:var(--cx-fg-dim,#8295ae);
    font:inherit;font-size:10.5px;font-weight:600;letter-spacing:.14em;
    min-height:32px;min-width:44px;padding:0 14px;border-radius:5px;cursor:pointer}
  .twkx-mode button[aria-selected="true"]{background:var(--cx-accent,#7ee0ff);color:var(--cx-bg,#06080e)}
  .twkx-mode button:focus-visible{outline:2px solid var(--cx-accent,#7ee0ff);outline-offset:1px}
  .twkx-spacer{flex:1}
  .twkx-x{appearance:none;border:0;background:transparent;color:var(--cx-fg-dim,#8295ae);
    min-width:44px;min-height:44px;border-radius:6px;cursor:pointer;font-size:16px;line-height:1;
    display:inline-flex;align-items:center;justify-content:center}
  .twkx-x:hover{background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 14%, transparent);color:var(--cx-fg,#c9d6e6)}
  .twkx-x:focus-visible{outline:2px solid var(--cx-accent,#7ee0ff);outline-offset:1px}

  .twkx-shell{display:grid;grid-template-columns:172px 1fr;flex:1;min-height:0}
  /* ── nav rail (desktop) ─────────────────────────────────────────────── */
  .twkx-nav{display:flex;flex-direction:column;gap:2px;padding:14px 8px;
    border-right:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 18%, transparent);
    background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 4%, transparent);
    overflow-y:auto;min-height:0}
  .twkx-nav button{appearance:none;border:0;background:transparent;color:var(--cx-fg-dim,#8295ae);
    font:inherit;font-size:10px;font-weight:600;letter-spacing:.16em;text-align:left;
    min-height:44px;padding:0 12px;border-radius:6px;cursor:pointer;white-space:nowrap}
  .twkx-nav button:hover{background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 10%, transparent);color:var(--cx-fg,#c9d6e6)}
  .twkx-nav button.is-on{color:var(--cx-accent,#7ee0ff);
    background:color-mix(in oklab, var(--cx-accent,#7ee0ff) 10%, transparent)}
  .twkx-nav button.is-empty{display:none}
  .twkx-nav button:focus-visible{outline:2px solid var(--cx-accent,#7ee0ff);outline-offset:1px}
  .twkx-nav button.is-danger{color:color-mix(in oklab, #ff8291 80%, var(--cx-fg-dim,#8295ae))}

  /* ── body ───────────────────────────────────────────────────────────── */
  .twkx-main{display:flex;flex-direction:column;min-height:0;min-width:0}
  .twkx-search{flex:0 0 auto;display:flex;align-items:center;gap:8px;
    padding:12px 18px 10px;
    border-bottom:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 14%, transparent)}
  .twkx-search input{flex:1;min-width:0;height:36px;padding:0 12px;
    border-radius:7px;font:inherit;font-size:12px;letter-spacing:.04em;outline:none;
    color:var(--cx-fg,#c9d6e6);
    background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 7%, transparent);
    border:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 26%, transparent)}
  .twkx-search input:focus{border-color:var(--cx-accent,#7ee0ff);
    box-shadow:0 0 0 1px color-mix(in oklab, var(--cx-accent,#7ee0ff) 30%, transparent)}
  .twkx-search input::placeholder{color:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 80%, transparent)}
  .twkx-count{flex:0 0 auto;font-size:10px;color:var(--cx-fg-dim,#8295ae);letter-spacing:.08em;
    min-width:70px;text-align:right}
  .twkx-body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;
    padding:6px 18px 26px;scroll-behavior:smooth;
    scrollbar-width:thin;scrollbar-color:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 30%, transparent) transparent}
  .twkx-body::-webkit-scrollbar{width:8px}
  .twkx-body::-webkit-scrollbar-thumb{background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 25%, transparent);border-radius:4px}
  .twkx-help-body{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;padding:14px 18px}
  .twkx-help-body .cx-help{height:100%}

  .twkx-group{padding:18px 0 4px}
  .twkx-group[data-hidden="1"]{display:none}
  .twkx-group-h{font-size:10px;font-weight:700;letter-spacing:.26em;text-transform:uppercase;
    color:var(--cx-accent,#7ee0ff);padding:0 0 4px;
    border-bottom:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 20%, transparent);
    margin-bottom:10px}
  .twkx-group[data-group="DANGER"] .twkx-group-h{color:#ff8291;border-bottom-color:color-mix(in oklab, #ff8291 35%, transparent)}
  .twkx-group[data-group="DANGER"]{margin-top:18px;padding-top:14px}

  .twkx-item{padding:5px 0}
  .twkx-item.twkx-hide{display:none}
  .twkx-sub{font-size:9.5px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;
    color:var(--cx-fg-dim,#8295ae);padding:12px 0 4px;opacity:.85}
  .twkx-sub.twkx-hide{display:none}
  .twkx-hint{font-size:10.5px;color:var(--cx-fg-dim,#8295ae);line-height:1.5;margin:2px 0 0}
  .twkx-note{font-size:10.5px;color:var(--cx-fg-dim,#8295ae);line-height:1.5}
  .twkx-empty{padding:40px 12px;text-align:center;color:var(--cx-fg-dim,#8295ae);
    font-size:11px;letter-spacing:.08em}

  /* ── controls (kept structurally compatible with the app's children) ── */
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px;
    min-height:44px;cursor:pointer}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;gap:8px;
    color:var(--cx-fg,#c9d6e6);font-size:11px;letter-spacing:.05em}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:var(--cx-fg-dim,#8295ae);font-variant-numeric:tabular-nums}
  .twk-sect{font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;
    color:var(--cx-fg-dim,#8295ae);padding:10px 0 0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:32px;padding:0 10px;
    border:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 26%, transparent);
    border-radius:6px;font:inherit;font-size:11px;outline:none;
    background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 7%, transparent);
    color:var(--cx-fg,#c9d6e6)}
  .twk-field:focus{border-color:var(--cx-accent,#7ee0ff)}
  select.twk-field{padding-right:24px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='%238295ae' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:14px 0;
    border-radius:999px;background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 25%, transparent);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:26px;height:26px;border-radius:50%;background:var(--cx-accent,#7ee0ff);
    border:2px solid var(--cx-bg,#06080e);box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer}
  .twk-slider::-moz-range-thumb{width:24px;height:24px;border-radius:50%;
    background:var(--cx-accent,#7ee0ff);border:2px solid var(--cx-bg,#06080e);cursor:pointer}
  .twk-slider:focus-visible{outline:2px solid var(--cx-accent,#7ee0ff);outline-offset:4px}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:6px;
    background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 9%, transparent);
    border:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 18%, transparent);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:4px;
    background:var(--cx-accent,#7ee0ff);
    transition:left .14s cubic-bezier(.3,.7,.4,1),width .14s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:var(--cx-fg-dim,#8295ae);font:inherit;font-size:10.5px;font-weight:600;
    letter-spacing:.08em;min-height:38px;border-radius:4px;cursor:pointer;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}
  .twk-seg button[aria-checked="true"]{color:var(--cx-bg,#06080e);font-weight:700}
  .twk-seg button:focus-visible{outline:2px solid var(--cx-accent,#7ee0ff);outline-offset:1px}

  .twk-toggle{position:relative;flex:0 0 auto;width:42px;height:24px;border:0;border-radius:999px;
    background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 30%, transparent);
    transition:background .14s ease;cursor:pointer;padding:0;box-sizing:border-box}
  .twk-toggle[data-on="1"]{background:var(--cx-accent,#7ee0ff)}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;
    background:var(--cx-bg,#06080e);box-shadow:0 1px 2px rgba(0,0,0,.4);
    transition:transform .16s cubic-bezier(.3,.7,.4,1)}
  .twk-toggle[data-on="1"] i{transform:translateX(18px)}
  .twk-toggle:focus-visible{outline:2px solid var(--cx-accent,#7ee0ff);outline-offset:2px}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:32px;padding:0 0 0 10px;
    border:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 26%, transparent);border-radius:6px;
    background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 7%, transparent)}
  .twk-num-lbl{font-weight:500;color:var(--cx-fg-dim,#8295ae);cursor:ew-resize;user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:var(--cx-fg-dim,#8295ae)}

  .twk-btn{appearance:none;min-height:44px;padding:0 14px;border:1px solid color-mix(in oklab, var(--cx-accent,#7ee0ff) 40%, transparent);
    border-radius:6px;background:color-mix(in oklab, var(--cx-accent,#7ee0ff) 12%, transparent);
    color:var(--cx-fg,#c9d6e6);font:inherit;font-size:11px;font-weight:600;letter-spacing:.08em;cursor:pointer}
  .twk-btn:hover{background:color-mix(in oklab, var(--cx-accent,#7ee0ff) 22%, transparent)}
  .twk-btn.secondary{background:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 8%, transparent);
    border-color:color-mix(in oklab, var(--cx-fg-dim,#8295ae) 26%, transparent)}
  .twk-btn:focus-visible{outline:2px solid var(--cx-accent,#7ee0ff);outline-offset:1px}
  .cx-mini-btn{min-height:44px}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:24px;
    border:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 26%, transparent);border-radius:6px;padding:0;cursor:pointer;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:44px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:pointer;
    box-shadow:0 0 0 1px color-mix(in oklab, var(--cx-fg-dim,#8295ae) 28%, transparent);
    transition:transform .12s,box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 2px var(--cx-accent,#7ee0ff)}
  .twk-chip:focus-visible{outline:2px solid var(--cx-accent,#7ee0ff);outline-offset:2px}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;display:flex;flex-direction:column}
  .twk-chip>span>i{flex:1}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}

  /* key field with reveal-eye + test (AIModelSection) */
  .twkx-keyrow{display:flex;gap:6px;align-items:stretch}
  .twkx-keyrow input{flex:1;min-width:0}
  .twkx-eye{appearance:none;border:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 26%, transparent);
    border-radius:6px;background:transparent;color:var(--cx-fg-dim,#8295ae);min-width:44px;min-height:32px;
    cursor:pointer;font-size:13px}
  .twkx-eye:hover{color:var(--cx-fg,#c9d6e6)}

  /* ── mobile sheet (≤700px) ──────────────────────────────────────────── */
  @media (max-width: 700px){
    .twkx-panel{top:0;left:0;transform:none;width:100vw;height:100dvh;max-width:100vw;max-height:100dvh;
      border-radius:0;border:0;
      padding-bottom:env(safe-area-inset-bottom,0)}
    @keyframes twkx-pop{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
    .twkx-shell{grid-template-columns:1fr;grid-template-rows:auto 1fr}
    .twkx-nav{flex-direction:row;overflow-x:auto;overflow-y:hidden;padding:6px 8px;gap:4px;
      border-right:0;border-bottom:1px solid color-mix(in oklab, var(--cx-fg-dim,#8295ae) 18%, transparent);
      scrollbar-width:none}
    .twkx-nav::-webkit-scrollbar{display:none}
    .twkx-nav button{flex:0 0 auto;font-size:9.5px;padding:0 10px}
    .twkx-head{padding:8px 6px 8px 14px}
    .twkx-title{letter-spacing:.16em}
    .twkx-body{padding:4px 14px calc(env(safe-area-inset-bottom,16px) + 20px)}
    .twkx-search{padding:10px 14px 8px}
    .twkx-count{display:none}
  }
`;
