// settings — migrated feature entry (Backlog 4.4). Replaces dist/tweaks-panel.js
// in the Vite build (gen-web-entry maps it). Re-exposes the same window globals
// the legacy tweaks-panel.jsx did (useTweaks + every Tweak* control + the
// panel), and runs the same module-load side-effects: publish the deprecated
// set, migrate the legacy engage* keys, and build the settings index.
import { TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from "./controls.js";
import { useTweaks } from "./useTweaks.js";
import { TweaksPanel } from "./TweaksPanel.js";
import { TweakPersonalization } from "./TweakPersonalization.js";
import { TweakContinuity } from "./TweakContinuity.js";
import { TweakOS7, TweakSchizoToggle } from "./TweakMisc.js";
import { AIModelSection } from "./AIModelSection.js";
import { LightThemePicker } from "./LightThemePicker.js";
import { registerDeprecated, migrateEngage, refreshSettingsIndex } from "./settings-index.js";

// Module-load side-effects (order matches legacy: deprecated set published,
// one-time engage→continuity migration, then the index is built).
registerDeprecated();
migrateEngage();
refreshSettingsIndex();

Object.assign(window, {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton,
  TweakPersonalization,
  TweakSchizoToggle,
  TweakContinuity,
  TweakOS7,
  AIModelSection,
  LightThemePicker,
});
