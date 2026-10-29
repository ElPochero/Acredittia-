import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "../..");
const landingDir = path.join(repoRoot, "frontend/components/landing");

test("no-regresion.test.mjs: no regresión de los 10 hallazgos marcados Correcto por QA (H-02, H-07, H-16, H-18, H-25, H-33, H-42, H-48, H-51, H-52)", () => {
  // H-02: Nav con anclas suaves a secciones canónicas
  const navContent = fs.readFileSync(path.join(landingDir, "LandingNav.tsx"), "utf-8");
  assert.match(navContent, /href=\{`#\$\{LANDING_SECTIONS\.FLUJO\}`\}/, "H-02: Nav debe enlazar a #flujo");
  assert.match(navContent, /href=\{`#\$\{LANDING_SECTIONS\.PLATAFORMA\}`\}/, "H-02: Nav debe enlazar a #plataforma");

  // H-07: Grilla de faenas tiene CTA funcional sin affordance falso (H-11, H-07)
  const faenasContent = fs.readFileSync(path.join(landingDir, "LandingFaenas.tsx"), "utf-8");
  assert.match(faenasContent, /href=\{`#\$\{LANDING_SECTIONS\.CONTACT\}`\}/, "H-07: Faenas debe incluir CTA a #contact");

  // H-16: Ecosistema comunica el hub central ACREDITTIA
  const ecoContent = fs.readFileSync(path.join(landingDir, "LandingEcosistema.tsx"), "utf-8");
  assert.match(ecoContent, /Hub Central ACREDITTIA/i, "H-16: Ecosistema debe incluir 'Hub Central ACREDITTIA'");

  // H-18: Se conservan animaciones sutiles del canal WhatsApp
  const agentesContent = fs.readFileSync(path.join(landingDir, "LandingAgentes.tsx"), "utf-8");
  assert.match(agentesContent, /SCENARIOS|WhatsApp/i, "H-18: Agentes debe incluir escenarios interactivos");

  // H-25: Scroll preservado sin transform en root
  const pageContent = fs.readFileSync(path.join(landingDir, "LandingPage.tsx"), "utf-8");
  assert.doesNotMatch(pageContent, /id=["']landing["'][^>]*\btransform\b/i, "H-25: #landing no debe tener transform");

  // H-33: Hover de tarjetas sin bloqueos
  const problemaContent = fs.readFileSync(path.join(landingDir, "LandingProblema.tsx"), "utf-8");
  assert.match(problemaContent, /hover:/, "H-33: Tarjetas deben tener hover fluido");

  // H-42: CTA de inicio a login desde el hero
  const heroContent = fs.readFileSync(path.join(landingDir, "LandingHero.tsx"), "utf-8");
  assert.match(heroContent, /href=["']\/login["']/, "H-42: Hero debe incluir enlace a /login");

  // H-48: Mock de importación y planilla Excel a checklist
  const planillaContent = fs.readFileSync(path.join(landingDir, "LandingPlanilla.tsx"), "utf-8");
  assert.match(planillaContent, /Excel/i, "H-48: Planilla debe referenciar Excel");
  assert.match(planillaContent, /Checklist/i, "H-48: Planilla debe referenciar Checklist");

  // H-51: Acceso a login visible desde la navegación
  assert.match(navContent, /Iniciar sesión/i, "H-51: Nav debe incluir 'Iniciar sesión'");
  assert.match(navContent, /href=["']\/login["']/, "H-51: Nav debe enlazar a /login");

  // H-52: Enlaces de acceso y exploración en el footer (ref. 1752-1759)
  const footerContent = fs.readFileSync(path.join(landingDir, "LandingFooter.tsx"), "utf-8");
  assert.match(footerContent, /href=\{`#\$\{LANDING_SECTIONS\.FLUJO\}`\}/, "H-52: Footer debe enlazar a #flujo");
  assert.match(footerContent, /href=\{`#\$\{LANDING_SECTIONS\.PLATAFORMA\}`\}/, "H-52: Footer debe enlazar a #plataforma");
  assert.match(footerContent, /href=["']\/privacidad["']/, "H-52: Footer debe incluir enlace a /privacidad");
  assert.match(footerContent, /href=["']\/terminos["']/, "H-52: Footer debe incluir enlace a /terminos");
});
