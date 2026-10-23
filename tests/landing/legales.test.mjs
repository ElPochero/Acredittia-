import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "../..");
const footerFile = path.join(repoRoot, "frontend/components/landing/LandingFooter.tsx");
const privacidadFile = path.join(repoRoot, "frontend/app/privacidad/page.tsx");
const terminosFile = path.join(repoRoot, "frontend/app/terminos/page.tsx");

test("legales.test.mjs: footer contiene © 2026, sin debug string, y existen /privacidad y /terminos", () => {
  // 1. LandingFooter.tsx existe y cumple requisitos de aviso legal
  assert.ok(fs.existsSync(footerFile), "LandingFooter.tsx debe existir");
  const footerContent = fs.readFileSync(footerFile, "utf-8");

  assert.match(
    footerContent,
    /©\s*2026\s+ACREDITTIA/i,
    "El footer debe contener '© 2026 ACREDITTIA' (R7, H-54, H-55)"
  );

  assert.doesNotMatch(
    footerContent,
    /v3\s*·\s*azul\s*\+\s*naranja/i,
    "El footer no debe contener la cadena residual 'v3 · azul + naranja' (H-55)"
  );

  assert.match(
    footerContent,
    /href=["']\/privacidad["']/i,
    "El footer debe enlazar a '/privacidad' (H-54)"
  );

  assert.match(
    footerContent,
    /href=["']\/terminos["']/i,
    "El footer debe enlazar a '/terminos' (H-54)"
  );

  // 2. Ruta /privacidad existe y contiene referencias a normativa
  assert.ok(
    fs.existsSync(privacidadFile),
    "La ruta /privacidad debe existir en app/privacidad/page.tsx (H-54, H-55)"
  );
  const privacidadContent = fs.readFileSync(privacidadFile, "utf-8");
  assert.match(
    privacidadContent,
    /19\.628/i,
    "La página de privacidad debe referenciar la Ley 19.628 de protección de datos personales"
  );

  // 3. Ruta /terminos existe
  assert.ok(
    fs.existsSync(terminosFile),
    "La ruta /terminos debe existir en app/terminos/page.tsx (H-54, H-55)"
  );
  const terminosContent = fs.readFileSync(terminosFile, "utf-8");
  assert.match(
    terminosContent,
    /Términos y Condiciones/i,
    "La página de términos debe contener su título formal"
  );
});
