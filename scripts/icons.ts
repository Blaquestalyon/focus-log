/**
 * Renders the §2 app mark (a metallic-gold four-point sparkle inside a 1.5px gold ring) centred on
 * #07080D into the three PNGs under public/icons/. Runs before every build (`prebuild`); the PNGs are
 * generated, not committed (the repo carries text files only).
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SPARKLE = 'M12 0C12.9 7.2 16.8 11.1 24 12C16.8 12.9 12.9 16.8 12 24C11.1 16.8 7.2 12.9 0 12C7.2 11.1 11.1 7.2 12 0Z';

/** The mark in a 24-unit box, scaled to `markSize` px and centred on a `size` px square. */
function svg(size: number, markSize: number): string {
  const scale = markSize / 24;
  const offset = (size - markSize) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F7E7A6"/><stop offset="0.42" stop-color="#E2BC5C"/>
      <stop offset="0.68" stop-color="#B98A2C"/><stop offset="1" stop-color="#EFD27A"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="#07080D"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <circle cx="12" cy="12" r="11.25" fill="none" stroke="#D4A745" stroke-width="1.5"/>
    <g transform="translate(4 4) scale(0.6667)"><path d="${SPARKLE}" fill="url(#gold)"/></g>
  </g>
</svg>`;
}

async function main() {
  const out = path.join(process.cwd(), 'public', 'icons');
  // The folder holds only generated files, so a clean checkout does not have it.
  fs.mkdirSync(out, { recursive: true });
  await sharp(Buffer.from(svg(192, 192 * 0.75))).png().toFile(path.join(out, 'icon-192.png'));
  await sharp(Buffer.from(svg(512, 512 * 0.75))).png().toFile(path.join(out, 'icon-512.png'));
  // Maskable: the mark stays inside the central 60% (20% safe padding on every side).
  await sharp(Buffer.from(svg(512, 512 * 0.6))).png().toFile(path.join(out, 'icon-512-maskable.png'));
  console.log('icons written to public/icons');
}

void main();
