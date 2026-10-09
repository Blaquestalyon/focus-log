#!/usr/bin/env node
/**
 * T-X1: components and screens use design tokens only. Fails on any raw hex colour or `px`
 * value in src/components or src/app (tokens live in src/styles/tokens.css).
 */
import fs from 'node:fs';
import path from 'node:path';

const roots = ['src/components', 'src/app'];
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const PX = /\b\d+(\.\d+)?px\b/g;
const problems = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(entry.name)) check(p);
  }
}

function check(file) {
  // Comments may describe sizes; strip block comments (keeping line breaks) before checking.
  const text = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    for (const re of [HEX, PX]) {
      for (const m of code.matchAll(re)) {
        // `href="#main"`-style anchors and `#status` fragments are not colours.
        if (re === HEX && /^#(main|status)$/.test(m[0])) continue;
        problems.push(`${file}:${i + 1}: raw value ${m[0]} — use a token from src/styles/tokens.css`);
      }
    }
  });
}

for (const r of roots) if (fs.existsSync(r)) walk(r);
if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} raw value(s) found.`);
  process.exit(1);
}
console.log('Token lint: no raw hex or px values in components or screens.');
