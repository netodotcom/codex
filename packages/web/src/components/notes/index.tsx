// notes — migrated feature entry. Replaces legacy/deleted/dist/notes.js in the
// Vite build (gen-web-entry maps it). Reproduces the legacy IIFE's single
// load-time side effect: Object.assign(window, { Notes }).
// No plugin registration — Notes is a standalone floating widget, not a panel.
import { Notes } from "./NotesPanel.js";
import { nw } from "./notes-window.js";

// Expose the same window global the legacy set (identical name, identical timing).
nw().Notes = Notes;
