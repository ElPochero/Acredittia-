import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "../..");
const landingDir = path.join(repoRoot, "frontend/components/landing");

test("cifras.test.mjs: toda métrica numérica del copy viene acompañada de unidad y contexto (H-28, H-37, H-46)", () => {
  const files = fs.readdirSync(landingDir).filter((f) => f.endsWith(".tsx"));

  // 1. Verificar ausencia de métricas huérfanas de la landing anterior (H-37)
  for (const file of files) {
    const content = fs.readFileSync(path.join(landingDir, file), "utf-8");

    assert.doesNotMatch(
      content,
      /240\.?000|8\.?000\s*(?:CLP|\$)|CLP\s*\$|UF\s*\$|pesos\s+chilenos/i,
      `${file} no debe contener métricas financieras huérfanas sin contexto (H-37)`
    );
  }

  // 2. Verificar que LandingStats contiene las 4 métricas con unidad y sujeto (H-28, H-46)
  const statsFile = path.join(landingDir, "LandingStats.tsx");
  assert.ok(fs.existsSync(statsFile), "LandingStats.tsx debe existir");
  const statsContent = fs.readFileSync(statsFile, "utf-8");

  assert.ok(
    (statsContent.includes('-80%') || (statsContent.includes('prefix: "-"') && statsContent.includes('80') && statsContent.includes('suffix: "%"'))),
    "LandingStats debe incluir -80%"
  );
  assert.match(statsContent, /Reducción/i, "LandingStats debe incluir contexto de reducción");
  assert.match(statsContent, /Faenas/i, "LandingStats debe indicar faenas integradas");
  assert.match(statsContent, /Documentos centralizados/i, "LandingStats debe incluir documentos centralizados");

  // 3. Verificar que LandingFaenas titula con unidad y sujeto
  const faenasFile = path.join(landingDir, "LandingFaenas.tsx");
  assert.ok(fs.existsSync(faenasFile), "LandingFaenas.tsx debe existir");
  const faenasContent = fs.readFileSync(faenasFile, "utf-8");
  assert.match(faenasContent, /9 faenas ya integradas/i, "LandingFaenas debe llevar '9 faenas ya integradas' (H-28)");

  // 4. Verificar que LandingCarpetas incluye el avance porcentual del 68%
  const carpetasFile = path.join(landingDir, "LandingCarpetas.tsx");
  assert.ok(fs.existsSync(carpetasFile), "LandingCarpetas.tsx debe existir");
  const carpetasContent = fs.readFileSync(carpetasFile, "utf-8");
  assert.match(carpetasContent, /68%/, "LandingCarpetas debe incluir la cifra del 68% animada");
});
