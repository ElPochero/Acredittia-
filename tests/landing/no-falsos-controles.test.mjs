import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "../..");
const landingDir = path.join(repoRoot, "frontend/components/landing");

test("no-falsos-controles.test.mjs: cero disabled decorativos en landing y control de pausa en rotaciones", () => {
  const files = fs.readdirSync(landingDir).filter((f) => f.endsWith(".tsx"));

  for (const file of files) {
    const content = fs.readFileSync(path.join(landingDir, file), "utf-8");

    // En LandingFlujo y LandingFaenas no debe haber botones con disabled
    if (file === "LandingFlujo.tsx" || file === "LandingFaenas.tsx") {
      assert.doesNotMatch(
        content,
        /<button[^>]*disabled(?:\s*=\s*(?:\{true\}|["']disabled["']|["']["']))?[^>]*>/i,
        `${file} no debe contener botones con disabled decorativo (H-47, H-11)`
      );
    }

    // Los carruseles o rotadores automáticos (HeroMockup, Agentes) deben soportar pausa
    if (file === "LandingHeroMockup.tsx" || file === "LandingAgentes.tsx") {
      assert.match(
        content,
        /prefersReducedMotion|prefers-reduced-motion|isManualPaused|isHovered/i,
        `${file} debe implementar guardrails de accesibilidad y pausa de autoplay (WCAG 2.2.2)`
      );
    }
  }
});
