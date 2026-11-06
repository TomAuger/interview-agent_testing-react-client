/**
 * Drag-to-resize width for a side pane, using pointer capture on a gutter
 * element. `side` picks the drag direction: a 'left' pane grows when the
 * pointer moves right, a 'right' pane grows when it moves left. Width is
 * clamped to [min, max] and optionally persisted to localStorage.
 */
import { useCallback, useRef, useState } from 'react';
import type React from 'react';

interface ResizableOptions {
  /** Starting (and fallback) width in px. */
  initial: number;
  min: number;
  max: number;
  /** Which side of the layout the pane sits on. */
  side: 'left' | 'right';
  /** localStorage key; omit to skip persistence. */
  storageKey?: string;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const readStored = (storageKey: string | undefined, fallback: number, min: number, max: number) => {
  if (storageKey === undefined) return fallback;
  const raw = localStorage.getItem(storageKey);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
};

export interface GutterProps {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export function useResizableWidth({
  initial,
  min,
  max,
  side,
  storageKey,
}: ResizableOptions): { width: number; gutterProps: GutterProps } {
  const [width, setWidth] = useState(() => readStored(storageKey, initial, min, max));
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  // Read current width inside move without re-creating handlers.
  const widthRef = useRef(width);
  widthRef.current = width;

  const endDrag = useCallback(() => {
    if (drag.current === null) return;
    drag.current = null;
    if (storageKey !== undefined) {
      localStorage.setItem(storageKey, String(Math.round(widthRef.current)));
    }
  }, [storageKey]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only the primary button starts a resize.
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startWidth: widthRef.current };
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (drag.current === null) return;
      const delta = e.clientX - drag.current.startX;
      const next = drag.current.startWidth + (side === 'left' ? delta : -delta);
      setWidth(clamp(next, min, max));
    },
    [min, max, side],
  );

  const onPointerUp = useCallback(() => endDrag(), [endDrag]);

  return {
    width,
    gutterProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
