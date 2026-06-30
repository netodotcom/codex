// settings — tweak control primitives (migrated from tweaks-panel.jsx). Markup
// kept structurally compatible with the app's host-provided children. Exported
// names unchanged (TweakSlider, TweakToggle, …).
import React from "react";
import { isLight } from "./registry.js";

export type SelectOption = string | { value: string; label: string };

export function TweakSection({ label, children }: { label: React.ReactNode; children?: React.ReactNode }): React.ReactElement {
  return (
    <>
      <div className="twk-sect">{label}</div>
      {children}
    </>
  );
}

export function TweakRow({
  label,
  value,
  children,
  inline = false,
}: {
  label: React.ReactNode;
  value?: React.ReactNode;
  children?: React.ReactNode;
  inline?: boolean;
}): React.ReactElement {
  return (
    <div className={inline ? "twk-row twk-row-h" : "twk-row"}>
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  );
}

export function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (n: number) => void;
}): React.ReactElement {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input type="range" className="twk-slider" min={min} max={max} step={step} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
    </TweakRow>
  );
}

export function TweakToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }): React.ReactElement {
  return (
    <div className="twk-row twk-row-h" onClick={() => onChange(!value)}>
      <div className="twk-lbl">
        <span>{label}</span>
      </div>
      <button
        type="button"
        className="twk-toggle"
        data-on={value ? "1" : "0"}
        role="switch"
        aria-checked={!!value}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!value);
        }}
      >
        <i />
      </button>
    </div>
  );
}

export function TweakSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
}): React.ReactElement {
  return (
    <TweakRow label={label}>
      <select className="twk-field" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === "object" ? o.value : o;
          const l = typeof o === "object" ? o.label : o;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    </TweakRow>
  );
}

export function TweakRadio({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
}): React.ReactElement {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const valueRef = React.useRef(value);
  valueRef.current = value;

  const labelLen = (o: SelectOption): number => String(typeof o === "object" ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= (({ 2: 16, 3: 11, 4: 8 } as Record<number, number>)[options.length] ?? 0);
  const opts = options.map((o) => (typeof o === "object" ? o : { value: o, label: o }));
  const idx = Math.max(0, opts.findIndex((o) => o.value === value));
  const n = opts.length;

  const segAt = (clientX: number): string => {
    const track = trackRef.current;
    if (!track) return valueRef.current;
    const r = track.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor(((clientX - r.left - 2) / inner) * n);
    return opts[Math.max(0, Math.min(n - 1, i))]?.value ?? valueRef.current;
  };

  const onPointerDown = (e: React.PointerEvent): void => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev: PointerEvent): void => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = (): void => {
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  if (!fitsAsSegments) {
    const resolve = (s: string): string => {
      const m = options.find((o) => String(typeof o === "object" ? o.value : o) === s);
      return m === undefined ? s : typeof m === "object" ? m.value : m;
    };
    return <TweakSelect label={label} value={value} options={options} onChange={(s) => onChange(resolve(s))} />;
  }

  return (
    <TweakRow label={label}>
      <div ref={trackRef} role="radiogroup" aria-label={label} onPointerDown={onPointerDown} className={dragging ? "twk-seg dragging" : "twk-seg"}>
        <div className="twk-seg-thumb" style={{ left: `calc(2px + ${idx} * (100% - 4px) / ${n})`, width: `calc((100% - 4px) / ${n})` }} />
        {opts.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

export function TweakText({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}): React.ReactElement {
  return (
    <TweakRow label={label}>
      <input className="twk-field" type="text" value={value} placeholder={placeholder} aria-label={label} onChange={(e) => onChange(e.target.value)} />
    </TweakRow>
  );
}

export function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (n: number) => void;
}): React.ReactElement {
  const clamp = (n: number): number => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({ x: 0, val: 0 });
  const onScrubStart = (e: React.PointerEvent): void => {
    e.preventDefault();
    startRef.current = { x: e.clientX, val: value };
    const decimals = (String(step).split(".")[1] || "").length;
    const move = (ev: PointerEvent): void => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div className="twk-num">
      <span className="twk-num-lbl" onPointerDown={onScrubStart}>
        {label}
      </span>
      <input type="number" value={value} min={min} max={max} step={step} aria-label={label} onChange={(e) => onChange(clamp(Number(e.target.value)))} />
      {unit && <span className="twk-num-unit">{unit}</span>}
    </div>
  );
}

const TwkCheck = ({ light }: { light: boolean }): React.ReactElement => (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3 7.2 5.8 10 11 4.2" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" stroke={light ? "rgba(0,0,0,.78)" : "#fff"} />
  </svg>
);

export type ColorOption = string | string[];

export function TweakColor({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: ColorOption;
  options?: ColorOption[];
  onChange: (v: ColorOption) => void;
}): React.ReactElement {
  if (!options || !options.length) {
    return (
      <div className="twk-row twk-row-h">
        <div className="twk-lbl">
          <span>{label}</span>
        </div>
        <input type="color" className="twk-swatch" value={String(value)} aria-label={label} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  const key = (o: ColorOption): string => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return (
    <TweakRow label={label}>
      <div className="twk-chips" role="radiogroup" aria-label={label}>
        {options.map((o, i) => {
          const colors = Array.isArray(o) ? o : [o];
          const [hero, ...rest] = colors;
          const sup = rest.slice(0, 4);
          const on = key(o) === cur;
          return (
            <button
              key={i}
              type="button"
              className="twk-chip"
              role="radio"
              aria-checked={on}
              data-on={on ? "1" : "0"}
              aria-label={colors.join(", ")}
              title={colors.join(" · ")}
              style={{ background: hero }}
              onClick={() => onChange(o)}
            >
              {sup.length > 0 && (
                <span>
                  {sup.map((c, j) => (
                    <i key={j} style={{ background: c }} />
                  ))}
                </span>
              )}
              {on && <TwkCheck light={isLight(hero ?? "#000")} />}
            </button>
          );
        })}
      </div>
    </TweakRow>
  );
}

export function TweakButton({ label, onClick, secondary = false }: { label: React.ReactNode; onClick?: () => void; secondary?: boolean }): React.ReactElement {
  return (
    <button type="button" className={secondary ? "twk-btn secondary" : "twk-btn"} onClick={onClick}>
      {label}
    </button>
  );
}
