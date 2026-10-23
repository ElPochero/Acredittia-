import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "../..");
const landingDir = path.join(repoRoot, "frontend/components/landing");

test("multimedia.test.mjs: cero <video>, .mp4, .gif y cero marcas de agua en landing", () => {
  const files = fs.readdirSync(landingDir).filter((f) => f.endsWith(".tsx"));

  for (const file of files) {
    const content = fs.readFileSync(path.join(landingDir, file), "utf-8");

    assert.doesNotMatch(
      content,
      /<video/i,
      `${file} no debe contener elementos <video> (R3, H-24)`
    );

    assert.doesNotMatch(
      content,
      /\.(?:mp4|gif)/i,
      `${file} no debe referenciar archivos .mp4 ni .gif (R3, H-24, H-49)`
    );

    assert.doesNotMatch(
      content,
      /Gemini/i,
      `${file} no debe contener menciones ni marcas de agua de Gemini (H-29)`
    );
  }
});
