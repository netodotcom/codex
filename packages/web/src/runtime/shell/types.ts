// shell — shared TypeScript types.

/** Normalized RGB colour read from --cx-accent. */
export interface Tint {
  r: number;
  g: number;
  b: number;
}

/** A single parallax star in the cx-wall starfield. */
export interface Star {
  /** Normalized x position (0–1); wraps at edges. */
  x: number;
  /** Normalized y position (0–1); wraps at edges. */
  y: number;
  /** Depth: 0 = far, 1 = near. */
  z: number;
  /** CSS-px radius before DPR scale. */
  r: number;
  /** Base alpha. */
  a: number;
  /** Twinkle phase (radians). */
  tw: number;
  /** Twinkle speed (rad/s). */
  ts: number;
}
