// reader — long-press hook for touch devices (migrated from components.jsx).
// Fires onLongPress after `ms` of continuous touch (no movement); cancels on
// move/release. Pairs with onContextMenu so one element opens the menu on
// desktop right-click and mobile long-press. Suppresses the trailing click.
import React from "react";

const { useRef } = React;

export interface LongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  onClickCapture: (e: React.MouseEvent) => void;
}

export function useLongPress(onLongPress: (rect: DOMRect) => void, ms = 450): LongPressHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const start = (e: React.TouchEvent): void => {
    fired.current = false;
    const t = e.touches?.[0];
    startPos.current = t ? { x: t.clientX, y: t.clientY } : null;
    const target = e.currentTarget;
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress(target.getBoundingClientRect());
    }, ms);
  };
  const cancel = (): void => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const move = (e: React.TouchEvent): void => {
    if (!startPos.current || !e.touches?.[0]) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - startPos.current.x) > 10 || Math.abs(t.clientY - startPos.current.y) > 10) cancel();
  };
  // Suppress the click that follows a long-press so we don't double-fire.
  const click = (e: React.MouseEvent): void => {
    if (fired.current) {
      e.preventDefault();
      e.stopPropagation();
      fired.current = false;
    }
  };
  return {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    onClickCapture: click,
  };
}
