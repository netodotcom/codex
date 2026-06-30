// settings — continuity controls (migrated from tweaks-panel.jsx). Drives the
// canonical continuity keys the app consumes (continuityEnabled /
// continuityThreshold / notifyCadence); the old engage* quartet is deprecated
// (migrated at module load).
import React from "react";
import { TweakToggle, TweakSlider, TweakRadio } from "./controls.js";
import { cxTweaksRead, cxTweaksWrite, type TweakMap } from "./store.js";
import { tt } from "./settings-window.js";

interface ContinuityWindow {
  CODEX_TWEAK_DEFAULTS?: TweakMap;
  CODEX_ENGAGEMENT?: { setConfig?: (cfg: { dailyThreshold: number }) => void };
}

export function TweakContinuity(): React.ReactElement {
  const read = (): TweakMap => ({
    continuityEnabled: true,
    continuityThreshold: 1,
    notifyCadence: "subtle",
    ...((typeof window !== "undefined" && (window as unknown as ContinuityWindow).CODEX_TWEAK_DEFAULTS) || {}),
    ...cxTweaksRead(),
  });
  const [v, setV] = React.useState<TweakMap>(read);
  React.useEffect(() => {
    const onChange = (e: Event): void => {
      const d = (e as CustomEvent<TweakMap>).detail || {};
      if ("continuityEnabled" in d || "continuityThreshold" in d || "notifyCadence" in d) setV(read());
    };
    window.addEventListener("tweakchange", onChange);
    return () => window.removeEventListener("tweakchange", onChange);
  }, []);
  const set = (key: string, value: unknown): void => {
    cxTweaksWrite({ [key]: value });
    setV((prev) => ({ ...prev, [key]: value }));
    if (key === "continuityThreshold") {
      try {
        (window as unknown as ContinuityWindow).CODEX_ENGAGEMENT?.setConfig?.({ dailyThreshold: Number(value) });
      } catch {
        /* never throw from settings */
      }
    }
  };
  return (
    <>
      <TweakToggle label={tt("cx.tweak.enable", "Continuity layer")} value={v["continuityEnabled"] !== false} onChange={(val) => set("continuityEnabled", val)} />
      {v["continuityEnabled"] !== false && (
        <>
          <TweakSlider
            label={tt("cx.tweak.threshold", "Depth actions per day")}
            value={Number(v["continuityThreshold"]) || 1}
            min={1}
            max={5}
            step={1}
            onChange={(val) => set("continuityThreshold", val)}
          />
          <TweakRadio
            label={tt("cx.tweak.cadence", "Announcements")}
            value={(v["notifyCadence"] as string) || "subtle"}
            options={[
              { value: "off", label: tt("cx.tweak.cadence.off", "Off") },
              { value: "subtle", label: tt("cx.tweak.cadence.milestones", "Subtle") },
              { value: "all", label: tt("cx.tweak.cadence.all", "All") },
            ]}
            onChange={(val) => set("notifyCadence", val)}
          />
        </>
      )}
    </>
  );
}
