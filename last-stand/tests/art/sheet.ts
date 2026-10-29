import { blank, blit, type Bitmap } from '../../src/art/bitmap';

/** Lays out named frame lists in rows (one row per animation) with a background colour. */
export function contactSheet(groups: Record<string, Bitmap[]>, bg = 0x46803f, gap = 4): Bitmap {
  const rows = Object.values(groups);
  const width = Math.max(...rows.map((frames) => frames.reduce((w, f) => w + f.w + gap, gap)));
  const height = rows.reduce((h, frames) => h + Math.max(...frames.map((f) => f.h)) + gap, gap);
  const sheet = blank(width, height);
  for (let i = 0; i < sheet.data.length; i += 4) {
    sheet.data[i] = (bg >> 16) & 255;
    sheet.data[i + 1] = (bg >> 8) & 255;
    sheet.data[i + 2] = bg & 255;
    sheet.data[i + 3] = 255;
  }
  let y = gap;
  for (const frames of rows) {
    let x = gap;
    for (const f of frames) {
      blit(sheet, f, x, y);
      x += f.w + gap;
    }
    y += Math.max(...frames.map((f) => f.h)) + gap;
  }
  return sheet;
}
