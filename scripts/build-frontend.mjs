// Builds the Next.js app in frontend/ and copies its static export into
// public/, then re-adds dark mode.  npm run frontend:build
// Laravel's own files in public/ (index.php, .htaccess, storage, ...) are not
// part of the export, so they are left alone.
import { execSync } from "node:child_process";
import { cpSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FRONTEND = fileURLToPath(new URL("../frontend/", import.meta.url));
const OUT = fileURLToPath(new URL("../frontend/out/", import.meta.url));
const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));

execSync("npm run build", { cwd: FRONTEND, stdio: "inherit" });
cpSync(OUT, PUBLIC, { recursive: true, force: true });
console.log("copied frontend/out into public/");

await import("./inject-theme.mjs");
