import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Localizar directorio raíz del repo y carpeta de componentes landing
const repoRoot = path.resolve(__dirname, "../..");
const landingDir = path.join(repoRoot, "frontend/components/landing");
const sectionsFile = path.join(landingDir, "sections.ts");

test("anclas.test.mjs: todo href='#x' de la landing tiene id='x' y está en sections.ts", () => {
  assert.ok(fs.existsSync(sectionsFile), "sections.ts debe existir");

  const sectionsContent = fs.readFileSync(sectionsFile, "utf-8");
  // Extraer valores de LANDING_SECTIONS
  const sectionValues = [];
  const sectionMatches = sectionsContent.matchAll(/: *"([^"]+)"/g);
  for (const match of sectionMatches) {
    sectionValues.push(match[1]);
  }

  assert.ok(sectionValues.length >= 6, "Deben existir al menos 6 secciones canónicas en sections.ts");

  // Leer todos los archivos .tsx en components/landing
  const files = fs.readdirSync(landingDir).filter((f) => f.endsWith(".tsx"));
  const foundHrefs = new Set();
  const foundIds = new Set();

  for (const file of files) {
    const content = fs.readFileSync(path.join(landingDir, file), "utf-8");

    // Buscar href="#..." o href={`#${...}`}
    const hrefMatches = content.matchAll(/href=["']#([^"'`]+)["']/g);
    for (const m of hrefMatches) {
      foundHrefs.add(m[1]);
    }
    const templateHrefMatches = content.matchAll(/href=\{`#\$\{LANDING_SECTIONS\.([A-Z_]+)\}`\}/g);
    for (const m of templateHrefMatches) {
      // Mapear constante a valor en sections.ts
      const key = m[1];
      const valMatch = sectionsContent.match(new RegExp(`${key}:\\s*"([^"]+)"`));
      if (valMatch) {
        foundHrefs.add(valMatch[1]);
      }
    }

    // Buscar id="..." o id={LANDING_SECTIONS...}
    const idMatches = content.matchAll(/id=["']([^"'`]+)["']/g);
    for (const m of idMatches) {
      foundIds.add(m[1]);
    }
    const templateIdMatches = content.matchAll(/id=\{LANDING_SECTIONS\.([A-Z_]+)\}/g);
    for (const m of templateIdMatches) {
      const key = m[1];
      const valMatch = sectionsContent.match(new RegExp(`${key}:\\s*"([^"]+)"`));
      if (valMatch) {
        foundIds.add(valMatch[1]);
      }
    }
  }

  // Verificar que todas las anclas referenciadas existen en los componentes
  for (const href of foundHrefs) {
    // Si es un ancla interna de sección, debe existir id
    if (sectionValues.includes(href)) {
      assert.ok(
        foundIds.has(href),
        `El ancla #${href} referenciada en la landing debe tener un elemento con id="${href}"`
      );
    }
  }

  // Verificar que todas las secciones canónicas existen como id en la página
  for (const sec of sectionValues) {
    assert.ok(
      foundIds.has(sec),
      `La sección canónica '${sec}' definida en sections.ts debe existir en la landing con id="${sec}"`
    );
  }
});
