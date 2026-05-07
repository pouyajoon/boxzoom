import type { Rect } from "../types";

export function buildChildRects(childrenCount: number): Rect[] {
  if (childrenCount === 0) {
    return [];
  }

  const cols = Math.ceil(Math.sqrt(childrenCount));
  const rows = Math.ceil(childrenCount / cols);
  const cellW = 560 / cols;
  const cellH = 560 / rows;
  const size = Math.max(90, Math.min(180, Math.min(cellW, cellH) * 0.72));
  const gridW = cols * cellW;
  const gridH = rows * cellH;
  const startX = 500 - gridW / 2;
  const startY = 500 - gridH / 2;

  return Array.from({ length: childrenCount }, (_, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const centerX = startX + col * cellW + cellW / 2;
    const centerY = startY + row * cellH + cellH / 2;

    return {
      x: centerX - size / 2,
      y: centerY - size / 2,
      size,
    };
  });
}
