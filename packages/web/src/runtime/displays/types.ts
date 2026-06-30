// displays — shared TypeScript types.

/** All registered surface keys (matches the SURFACES map in helpers.ts). */
export type SurfaceKey =
  | "reader"
  | "library"
  | "oracle"
  | "marks"
  | "galaxy"
  | "trans"
  | "talmud"
  | "comm"
  | "gem"
  | "gnosis"
  | "disarm"
  | "exeg"
  | "txan";

export interface SurfaceDescriptor {
  label: string;
  open(): void;
}

export interface CodexDisplaysApi {
  /** All registered surface keys. */
  surfaces: string[];
  /** Map a WM window id (data-wm-id / console spec id) to its surface key, or null. */
  surfaceForWid(wid: string | null | undefined): string | null;
  /** True when this window was opened as a secondary display follower. */
  isFollower(): boolean;
  /** The ?surface= value for this window, or null on the primary window. */
  surface(): string | null;
  /** Open a popup for the given surface. Returns false on error or unknown surface. */
  open(s: string): boolean;
}
