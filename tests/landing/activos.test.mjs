import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "../..");
const landingDir = path.join(repoRoot, "frontend/components/landing");
const publicDir = path.join(repoRoot, "frontend/public");

test("activos.test.mjs: todo src='/...' de la landing existe en frontend/public", () => {
  assert.ok(fs.existsSync(publicDir), "frontend/public debe existir");

  const files = fs.readdirSync(landingDir).filter((f) => f.endsWith(".tsx"));
  const foundSrcs = new Set();

  for (const file of files) {
    const content = fs.readFileSync(path.join(landingDir, file), "utf-8");

    // Buscar src="/..." (Next.js Image o img)
    const srcMatches = content.matchAll(/src=["']\/([^"'`?#]+)["']/g);
    for (const m of srcMatches) {
      foundSrcs.add(m[1]);
    }
    // Buscar image: "/..." en objetos de configuración
    const objMatches = content.matchAll(/image:\s*["']\/([^"'`?#]+)["']/g);
    for (const m of objMatches) {
      foundSrcs.add(m[1]);
    }
  }

  assert.ok(foundSrcs.size > 0, "Se deben encontrar referencias a activos locales en la landing");

  for (const src of foundSrcs) {
    const fullPath = path.join(publicDir, src);
    assert.ok(
      fs.existsSync(fullPath),
      `El activo referenciado '/${src}' debe existir físicamente en frontend/public`
    );
  }
});
