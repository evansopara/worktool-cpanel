// Adds dark mode (public/theme.css + public/theme.js) to every exported page.
// The Next.js static export overwrites public/*.html, so re-run this after
// copying a new build in:  npm run inject-theme
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));
const SKIP = new Set(["_next", "auth_backup", "storage", "sounds"]);
const MARKER = "data-wc-theme";

// Runs before first paint so dark-mode users never see a white flash.
const INIT =
  `<script ${MARKER}>try{var t=localStorage.getItem("theme");` +
  `if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))` +
  `document.documentElement.classList.add("dark")}catch(e){}</script>`;
const ASSETS =
  `<link rel="stylesheet" href="/theme.css" ${MARKER}/>` +
  `<script src="/theme.js" defer ${MARKER}></script>`;

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) yield* htmlFiles(join(dir, entry.name));
    } else if (entry.name.endsWith(".html")) {
      yield join(dir, entry.name);
    }
  }
}

let changed = 0;
for (const file of htmlFiles(PUBLIC)) {
  const html = readFileSync(file, "utf8");
  if (html.includes(MARKER) || !html.includes("<head>") || !html.includes("</head>")) continue;
  writeFileSync(file, html.replace("<head>", "<head>" + INIT).replace("</head>", ASSETS + "</head>"));
  console.log("injected", relative(PUBLIC, file));
  changed++;
}
console.log(`${changed} page(s) updated`);
