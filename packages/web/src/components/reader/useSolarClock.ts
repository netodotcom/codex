// reader — solar clock hook (migrated from components.jsx). Ticks a Date every
// second and derives the current solar position + the active dark mode.
import React from "react";
import { computeSolar, solarHour, type Solar } from "./solar.js";

const { useState, useEffect, useMemo } = React;

export interface SolarClock {
  now: Date;
  solar: Solar;
  dark: boolean;
}

export function useSolarClock(autoTheme: boolean, manualDark: boolean): SolarClock {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const solar = useMemo(() => computeSolar(solarHour(now)), [now]);
  const dark = autoTheme ? solar.phase === "night" || solar.phase === "dusk" : manualDark;

  return { now, solar, dark };
}
