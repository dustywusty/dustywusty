// Builds the README images (styled like dusty.wtf) and the generated README blocks.
// Run: GITHUB_TOKEN=$(gh auth token) node scripts/build.mjs
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";

const USER = "dustywusty";
const MIN_STARS = 25; // contributions below this are left off
const EXCLUDE = []; // e.g. "some/repo"

// The terminal block at the top. Each line is one row of output under `whoami`.
const ABOUT = [
  "💼 engineer at copilotkit, owns devops & infra",
  "🛠️ builds copilotkit, ag-ui & openbot",
  "🏕️ i ❤️ to travel, hang out w/ friends, collect vinyl, camp and build things!",
  "🏔️ i've been a software engineer for two decades and aspire to escape to the mountains",
  "📍 PNW",
];

// Your own projects, in the order they show up. `desc` is what the card says.
const MINE = [
  { repo: "zoo", desc: "coding agents in cages. the only way out is a proxy you control" },
  { repo: "yourmove", desc: "chess with friends, no account needed" },
  { repo: "openspectre", desc: "spectre vr, the old mac tank game, in rust + wasm" },
  { repo: "dmud", desc: "multiplayer text mud in go" },
  { repo: "slighty-after-dark", desc: "after dark screen savers for mac + windows" },
  { repo: "human-hash-js", desc: "uuids into words you can say out loud" },
];

const HEADINGS = { contrib: "🤝 contributed to", mine: "🤓 mine" };

// Colors from dusty.wtf (console theme, purple accent).
const ACCENT = "#8460f1";
const THEMES = {
  dark: { bg: "#111114", text: "#ede8e8", dim: "#a3abba", border: "#3f3f44" },
  light: { bg: "#ffffff", text: "#151515", dim: "#727578", border: "#d6d6dc" },
};
const LANG = {
  Go: "#00ADD8", Rust: "#dea584", TypeScript: "#3178c6", JavaScript: "#f1e05a",
  "C++": "#f34b7d", Ruby: "#701516", Lua: "#000080", Shell: "#89e051",
};

// --- text as paths (Roboto Mono, so it looks the same everywhere) ---------

const FONT = JSON.parse(await readFile(new URL("./roboto-mono.json", import.meta.url), "utf8"));
const ADV = FONT.advance / FONT.upm; // monospace advance, as a fraction of font size
const EMOJI_FONT = `'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`;
const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
const graphemes = (s) => [...seg.segment(s)].map((g) => g.segment);
const isEmoji = (g) => !(g in FONT.regular);
const cols = (s) => graphemes(s).reduce((n, g) => n + (isEmoji(g) ? 2 : 1), 0);

// Draws `text` starting at (x, baseline y). Returns svg markup.
function text(str, { x, y, size, fill, bold = false }) {
  const glyphs = bold ? FONT.bold : FONT.regular;
  const s = size / FONT.upm;
  const step = ADV * size;
  let out = "";
  let d = [];
  for (const g of graphemes(str)) {
    if (isEmoji(g)) {
      out += `<text x="${(x + step * 0.1).toFixed(1)}" y="${(y + size * 0.05).toFixed(1)}" font-size="${size * 1.05}" font-family="${EMOJI_FONT}">${g}</text>`;
      x += step * 2;
      continue;
    }
    if (glyphs[g]) d.push(`<path transform="translate(${x.toFixed(1)} ${y}) scale(${s.toFixed(5)} ${-s.toFixed(5)})" d="${glyphs[g]}"/>`);
    x += step;
  }
  return `<g fill="${fill}">${d.join("")}</g>${out}`;
}

const STAR = "M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z";
const star = (x, y, size, fill) => `<path transform="translate(${x} ${y}) scale(${size / 16})" fill="${fill}" d="${STAR}"/>`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const svg = (w, h, label, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${body}</svg>\n`;
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${n}`);

async function writeThemed(base, make) {
  for (const [name, t] of Object.entries(THEMES)) await writeFile(`${base}-${name}.svg`, make(t));
}
const picture = (base, alt, attrs) =>
  `<picture><source media="(prefers-color-scheme: dark)" srcset="${base}-dark.svg"><img src="${base}-light.svg" ${attrs} alt="${esc(alt)}"></picture>`;

// --- pieces ----------------------------------------------------------------

const SIZE = 15;
const STEP = ADV * SIZE;
const LINE = 26;

function promptLine(y, t, command, cursor) {
  const host = "dusty.wtf";
  let x = 0;
  let out = text(host, { x, y, size: SIZE, fill: ACCENT });
  x += host.length * STEP;
  out += text(":~# ", { x, y, size: SIZE, fill: t.text });
  x += 4 * STEP;
  if (command) out += text(command, { x, y, size: SIZE, fill: t.text });
  if (cursor) {
    out += `<rect x="${x.toFixed(1)}" y="${y - SIZE * 0.8}" width="${(STEP * 0.9).toFixed(1)}" height="${SIZE * 1.05}" fill="${ACCENT}"><animate attributeName="opacity" values="1;0" dur="1.1s" calcMode="discrete" repeatCount="indefinite"/></rect>`;
  }
  return out;
}

function terminal(t) {
  const lines = ["dusty.wtf:~# whoami", ...ABOUT, "dusty.wtf:~# "];
  const w = Math.ceil(Math.max(...lines.map(cols)) * STEP + STEP * 2);
  let body = promptLine(18, t, "whoami");
  ABOUT.forEach((l, i) => (body += text(l, { x: 0, y: 18 + LINE * (i + 1), size: SIZE, fill: t.text })));
  body += promptLine(18 + LINE * (ABOUT.length + 1), t, "", true);
  return svg(w, LINE * (ABOUT.length + 2), ["whoami", ...ABOUT].join(" / "), body);
}

function heading(label, t) {
  const n = cols(label);
  const w = Math.ceil(n * STEP * 1.1) + 4;
  const body =
    text(label, { x: 0, y: 20, size: SIZE * 1.1, fill: t.text, bold: true }) +
    text("=".repeat(n), { x: 0, y: 36, size: SIZE * 1.1, fill: t.text, bold: true });
  return svg(w, 44, label, body);
}

function contribRow(r, width, t) {
  const n = fmt(r.stargazers_count).padStart(5);
  let body = text(n, { x: 0, y: 18, size: SIZE, fill: t.text, bold: true });
  body += star(6 * STEP, 6, 14, ACCENT);
  body += text(r.full_name, { x: 9 * STEP, y: 18, size: SIZE, fill: ACCENT });
  return svg(width, LINE, `${r.full_name}, ${fmt(r.stargazers_count)} stars`, body);
}

function wrap(str, max) {
  const lines = [""];
  for (const word of str.split(/\s+/)) {
    const cur = lines[lines.length - 1];
    if (cols((cur + " " + word).trim()) > max) lines.push(word);
    else lines[lines.length - 1] = (cur + " " + word).trim();
  }
  if (lines.length > 2) lines.splice(2, Infinity, lines[1].slice(0, max - 1) + "…");
  return lines;
}

const CARD_W = 400, CARD_H = 140;
function card(r, desc, t) {
  const pad = 20;
  const small = 13;
  let body = `<rect x="0.5" y="0.5" width="${CARD_W - 1}" height="${CARD_H - 1}" fill="${t.bg}" stroke="${t.border}"/>`;
  body += text(r.name, { x: pad, y: 34, size: 16, fill: ACCENT, bold: true });
  body += text("=".repeat(r.name.length), { x: pad, y: 50, size: 16, fill: ACCENT, bold: true });
  wrap(desc, Math.floor((CARD_W - pad * 2) / (ADV * small))).forEach(
    (l, i) => (body += text(l, { x: pad, y: 78 + i * 20, size: small, fill: t.text })),
  );
  let x = pad;
  const y = 124;
  if (r.language) {
    body += `<circle cx="${x + 5}" cy="${y - 4}" r="5" fill="${LANG[r.language] ?? t.dim}"/>`;
    body += text(r.language, { x: x + 16, y, size: 12, fill: t.dim });
    x += 16 + r.language.length * ADV * 12 + 20;
  }
  if (r.stargazers_count > 0) {
    body += star(x, y - 11, 13, t.dim);
    body += text(fmt(r.stargazers_count), { x: x + 18, y, size: 12, fill: t.dim });
  }
  return svg(CARD_W, CARD_H, `${r.name}: ${desc}`, body);
}

// --- GitHub ----------------------------------------------------------------

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is not set");
async function gh(path) {
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function contributions() {
  const names = new Set();
  for (let page = 1; ; page++) {
    const q = encodeURIComponent(`author:${USER} type:pr is:merged -user:${USER}`);
    const { items } = await gh(`search/issues?q=${q}&per_page=100&page=${page}`);
    for (const it of items) names.add(it.repository_url.replace("https://api.github.com/repos/", ""));
    if (items.length < 100) break;
  }
  const repos = [];
  for (const name of names) {
    if (EXCLUDE.includes(name)) continue;
    try {
      const r = await gh(`repos/${name}`);
      if (!r.private && !r.archived && r.stargazers_count >= MIN_STARS) repos.push(r);
    } catch {} // repos we can't see
  }
  return repos.sort((a, b) => b.stargazers_count - a.stargazers_count);
}

// --- write -----------------------------------------------------------------

function replaceBlock(md, name, body) {
  const re = new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  if (!re.test(md)) throw new Error(`README.md is missing the ${name} markers`);
  return md.replace(re, `$1\n${body}\n$2`);
}

await rm("assets/gen", { recursive: true, force: true });
await mkdir("assets/gen", { recursive: true });

await writeThemed("assets/gen/whoami", terminal);
for (const [key, label] of Object.entries(HEADINGS)) await writeThemed(`assets/gen/h-${key}`, (t) => heading(label, t));

const contrib = await contributions();
const rowW = Math.ceil((9 + Math.max(...contrib.map((r) => r.full_name.length))) * STEP) + 4;
const rows = [];
for (const r of contrib) {
  const base = `assets/gen/contrib-${r.full_name.replace("/", "--")}`;
  await writeThemed(base, (t) => contribRow(r, rowW, t));
  rows.push(`<a href="${r.html_url}">${picture(base, `${r.full_name} (${fmt(r.stargazers_count)} stars)`, `height="${LINE}"`)}</a><br>`);
}

const cards = [];
for (const { repo, desc } of MINE) {
  const r = await gh(`repos/${USER}/${repo}`);
  const base = `assets/gen/card-${r.name}`;
  await writeThemed(base, (t) => card(r, desc, t));
  cards.push(`<a href="${r.html_url}">${picture(base, r.name, `width="${CARD_W}"`)}</a>`);
}

let md = await readFile("README.md", "utf8");
md = replaceBlock(md, "whoami", picture("assets/gen/whoami", ["whoami", ...ABOUT].join(" / "), ""));
md = replaceBlock(md, "h-contrib", picture("assets/gen/h-contrib", HEADINGS.contrib, ""));
md = replaceBlock(md, "contrib", rows.join("\n"));
md = replaceBlock(md, "h-mine", picture("assets/gen/h-mine", HEADINGS.mine, ""));
md = replaceBlock(md, "mine", cards.join("\n"));
await writeFile("README.md", md);
console.log(`${contrib.length} contributions, ${cards.length} cards`);
