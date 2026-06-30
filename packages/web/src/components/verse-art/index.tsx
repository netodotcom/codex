// verse-art — migrated feature entry. Replaces legacy/deleted/dist/verse-art.js
// in the Vite build (gen-web-entry maps it). Reproduces the legacy module's
// load-time side effect: sets window.VerseArt to the React component — the
// exact same global the host (components.jsx) reads to render the art modal.
//
// No plugin registration and no self-injected CSS (the legacy file had neither).
import { VerseArt } from "./VerseArt.js";
import { vaw } from "./verse-art-window.js";

vaw().VerseArt = VerseArt;
