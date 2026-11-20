import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** Move one item to another position. Pure. */
export const moveItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
};

/**
 * Where a dragged item lands: the place of the item under the pointer, or of
 * the nearest one. Uses the items' real boxes, so it works left-to-right and
 * right-to-left alike. Pure.
 */
export const dropIndex = (x: number, boxes: { left: number; right: number }[]): number => {
  let best = 0, bestDist = Infinity;
  boxes.forEach((b, i) => {
    const dist = x < b.left ? b.left - x : x > b.right ? x - b.right : 0;
    if (dist < bestDist) { best = i; bestDist = dist; }
  });
  return best;
};

const LONG_PRESS_MS = 350;
const MOVE_PX = 5;

/**
 * Drag to reorder a horizontal row of chips, with mouse (after a small move)
 * or touch (after a long press, so ordinary swipes still scroll). The order
 * changes live; `onDrop` gets the final ids. A drag never counts as a click.
 */
export const useDragReorder = (ids: string[], onDrop: (ids: string[]) => void) => {
  const [order, setOrder] = useState(ids);
  const [dragging, setDragging] = useState<string | null>(null);
  const items = useRef(new Map<string, HTMLElement>());
  const state = useRef<{ id: string; x: number; y: number; started: boolean; timer?: ReturnType<typeof setTimeout>; pointerId: number; touch: boolean } | null>(null);
  const suppressClick = useRef(false);
  const current = useRef(order);
  current.current = order;

  // Follow the saved order when not dragging. Compare contents, not the array
  // (callers pass a new array each render, which would loop forever).
  const key = ids.join('\u0000');
  useEffect(() => { if (!dragging) setOrder(key ? key.split('\u0000') : []); }, [key, dragging]);

  // While dragging with touch, stop the page from scrolling.
  useEffect(() => {
    if (!dragging) return;
    const stop = (e: TouchEvent) => e.preventDefault();
    window.addEventListener('touchmove', stop, { passive: false });
    return () => window.removeEventListener('touchmove', stop);
  }, [dragging]);

  const begin = (id: string) => { if (state.current) { state.current.started = true; } setDragging(id); };

  const onPointerDown = (id: string) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const touch = e.pointerType === 'touch';
    state.current = { id, x: e.clientX, y: e.clientY, started: false, pointerId: e.pointerId, touch };
    if (touch) state.current.timer = setTimeout(() => { begin(id); navigator.vibrate?.(10); }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const s = state.current;
    if (!s || e.pointerId !== s.pointerId) return;
    if (!s.started) {
      const moved = Math.hypot(e.clientX - s.x, e.clientY - s.y);
      if (s.touch) { if (moved > 10) { clearTimeout(s.timer); state.current = null; } return; } // a swipe: let it scroll
      if (moved < MOVE_PX) return;
      begin(s.id);
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    const list = current.current;
    const boxes = list.map((id) => items.current.get(id)?.getBoundingClientRect() ?? { left: 0, right: 0 });
    const to = dropIndex(e.clientX, boxes);
    const from = list.indexOf(s.id);
    if (to !== from) setOrder(moveItem(list, from, to));
  };

  const end = () => {
    const s = state.current;
    state.current = null;
    if (!s) return;
    clearTimeout(s.timer);
    if (!s.started) return;
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 0);
    setDragging(null);
    if (current.current.join() !== ids.join()) onDrop(current.current);
  };

  /** Props for each draggable chip. */
  const itemProps = (id: string) => ({
    ref: (el: HTMLElement | null) => { if (el) items.current.set(id, el); else items.current.delete(id); },
    onPointerDown: onPointerDown(id),
    onPointerMove,
    onPointerUp: end,
    onPointerCancel: end,
    onClickCapture: (e: React.MouseEvent) => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); } },
    onContextMenu: (e: React.MouseEvent) => { if (state.current?.touch) e.preventDefault(); },
    'data-dragging': dragging === id || undefined,
  });

  return { order, dragging, itemProps };
};
