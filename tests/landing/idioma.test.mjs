import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "../..");
const landingDir = path.join(repoRoot, "frontend/components/landing");
const layoutFile = path.join(repoRoot, "frontend/app/layout.tsx");

test("idioma.test.mjs: sin selector de idioma en landing, lang='es' en layout y 100% español", () => {
  // 1. layout.tsx debe declarar lang="es"
  assert.ok(fs.existsSync(layoutFile), "layout.tsx debe existir");
  const layoutContent = fs.readFileSync(layoutFile, "utf-8");
  assert.match(
    layoutContent,
    /<html\s+lang=["']es["']/i,
    "El layout raíz debe declarar <html lang='es'>"
  );

  // 2. No debe haber ningún selector de idioma en la landing
  const files = fs.readdirSync(landingDir).filter((f) => f.endsWith(".tsx"));
  for (const file of files) {
    const content = fs.readFileSync(path.join(landingDir, file), "utf-8");
    assert.doesNotMatch(
      content,
      /LanguageSelector|SelectorIdioma|flag-us|flag-cl/i,
      `El componente ${file} no debe incluir un selector de idioma decorativo`
    );
  }

  // 3. LandingNav no debe tener botones de cambio de idioma
  const navContent = fs.readFileSync(path.join(landingDir, "LandingNav.tsx"), "utf-8");
  assert.doesNotMatch(
    navContent,
    /\b(EN|ES)\b\s*\|\s*\b(EN|ES)\b/i,
    "LandingNav no debe contener switchers de idioma (H-03)"
  );
});
