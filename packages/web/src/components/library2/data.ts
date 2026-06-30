// library2 — shelf definitions (migrated verbatim from library2.jsx).
// LIB2_SHELVES is a fixed ordered list that covers every canon the reader
// knows about.  label() is always called lazily (at render time) so that the
// i18n helper window.t is already in place when it runs.
import type { Lib2Book } from "./library2-window.js";
import { lw } from "./library2-window.js";

export interface ShelfDef {
  key: string;
  label: () => string;
  filter: (b: Lib2Book) => boolean;
}

export const LIB2_SHELVES: ShelfDef[] = [
  {
    key: "ot",
    label: () => (lw().t && lw().t!("lib.ot")) || "The Old Testament",
    filter: (b) => b.testament === "OT",
  },
  {
    key: "nt",
    label: () => (lw().t && lw().t!("lib.nt")) || "The New Testament",
    filter: (b) => b.testament === "NT",
  },
  {
    key: "deuterocanon",
    label: () => "Apocrypha · Deuterocanon",
    filter: (b) => b.testament === "DC" && b.canon === "deuterocanon",
  },
  {
    key: "orthodox",
    label: () => "Orthodox additions",
    filter: (b) => b.testament === "DC" && b.canon === "orthodox",
  },
  {
    key: "ethiopian",
    label: () => "Ge'ez · Ethiopian",
    filter: (b) => b.testament === "DC" && b.canon === "ethiopian",
  },
  {
    key: "armenian",
    label: () => "Armenian additions",
    filter: (b) => b.testament === "DC" && b.canon === "armenian",
  },
  {
    key: "syriac",
    label: () => "Syriac · Peshitta",
    filter: (b) => b.testament === "DC" && b.canon === "syriac",
  },
  {
    key: "coptic",
    label: () => "Coptic additions",
    filter: (b) => b.testament === "DC" && b.canon === "coptic",
  },
  {
    key: "pseudepigrapha",
    label: () => "Pseudepigrapha",
    filter: (b) => b.testament === "DC" && b.canon === "pseudepigrapha",
  },
];
