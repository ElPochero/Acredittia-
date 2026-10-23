"use client";

import React from "react";
import Image from "next/image";
import useReveal from "./useReveal";
import { LANDING_SECTIONS } from "./sections";

const DOCS_PERSONAS = ["🪪 Cédula", "📄 Contrato", "🩺 Exámenes", "📜 Certificados", "+ y más"];
const DOCS_EQUIPOS = ["📋 Padrón", "🔧 Revisión técnica", "🚦 Permiso circulación", "+ y más"];
const DOCS_EMPRESA = ["✅ ISO 9001", "🧾 F-90", "🏛️ Escritura sociedad", "⚠️ Cert. accidentabilidad", "+ y más"];

const BENEFICIOS_ACREDITTIA = [
  "🔔 Alertas y recordatorios",
  "⚠️ Detecta documentos erróneos",
  "🗺️ Requisitos mapeados por faena",
  "🕓 Historial de contratos pasados",
  "🔍 Detecta incongruencias",
  "🗂️ Todo centralizado",
  "🤖 Seguimiento con Agentes IA",
  "👁️ Visibilidad total de tus contratos",
  "⏱️ -80% horas-hombre (3-4 personas)",
];

const PLATAFORMAS_EXPORT = [
  { name: "SIGA", logo: "/plat_siga.png" },
  { name: "WEBCONTROL", logo: "/plat_webcontrol.png" },
  { name: "SUCAL", logo: "/plat_sucal.png" },
  { name: "METACONTRATAS", logo: "/plat_metacontratas.png" },
  { name: "MY PASS", logo: "/plat_mypass_icon.png" },
];

/**
 * LandingEcosistema — Ecosistema de integraciones en formato pills responsivo a todo ancho.
 * Resuelve H-23 (reemplaza 'Red de proveedores' con CTA real), H-27 (todos los nodos con etiqueta)
 * y H-45 (sin mapa global innecesario).
 * Referencia HTML: líneas 1353-1491.
 */
export default function LandingEcosistema() {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section
      ref={sectionRef}
      id="ecosistema"
      className="py-24 px-[6%] bg-landing-soft border-t border-landing-linea scroll-mt-20"
      aria-label="Ecosistema de integraciones de ACREDITTIA"
    >
      <div className="max-w-[1180px] mx-auto">
        {/* Encabezado */}
        <div className="max-w-[720px] mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-landing-azul-claro text-landing-azul font-bold text-[0.74rem] tracking-wider uppercase mb-4">
            <span className="w-2 h-2 rounded-full bg-landing-azul" />
            INTEGRACIONES
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-landing-ink tracking-tight mb-4">
            Un solo lugar para subir, un ecosistema completo para exportar
          </h2>
          <p className="text-landing-gris text-base sm:text-lg leading-relaxed">
            Sube cada documento una sola vez a ACREDITTIA y expórtalo automáticamente a la plataforma que use cada mandante, en el formato que corresponda.
          </p>
        </div>

        {/* Grilla responsiva de pills a todo ancho */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* Columna 1: Documentación que centralizas */}
          <div className="flex flex-col gap-5 bg-white border border-landing-linea rounded-2xl p-6 shadow-sm">
            <div className="border-b border-landing-linea pb-3">
              <span className="text-[0.72rem] font-bold uppercase tracking-wider text-landing-azul flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-landing-azul" />
                1. Qué subes (Una sola vez)
              </span>
              <h3 className="text-lg font-bold text-landing-ink mt-1">
                Documentación requerida
              </h3>
            </div>

            {/* Personas */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-landing-gris mb-2.5">
                Documentación personas
              </h4>
              <div className="flex flex-wrap gap-2">
                {DOCS_PERSONAS.map((doc, idx) => (
                  <span
                    key={idx}
                    className={`text-[0.78rem] font-bold px-3 py-1.5 rounded-xl border ${
                      doc.startsWith("+")
                        ? "bg-transparent border-dashed border-landing-linea text-landing-gris"
                        : "bg-landing-azul-claro/70 border-landing-azul/20 text-landing-azul-d"
                    }`}
                  >
                    {doc}
                  </span>
                ))}
              </div>
            </div>

            {/* Equipos */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-landing-gris mb-2.5">
                Documentación equipos
              </h4>
              <div className="flex flex-wrap gap-2">
                {DOCS_EQUIPOS.map((doc, idx) => (
                  <span
                    key={idx}
                    className={`text-[0.78rem] font-bold px-3 py-1.5 rounded-xl border ${
                      doc.startsWith("+")
                        ? "bg-transparent border-dashed border-landing-linea text-landing-gris"
                        : "bg-landing-azul-claro/70 border-landing-azul/20 text-landing-azul-d"
                    }`}
                  >
                    {doc}
                  </span>
                ))}
              </div>
            </div>

            {/* Empresa */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-landing-gris mb-2.5">
                Documentación empresa
              </h4>
              <div className="flex flex-wrap gap-2">
                {DOCS_EMPRESA.map((doc, idx) => (
                  <span
                    key={idx}
                    className={`text-[0.78rem] font-bold px-3 py-1.5 rounded-xl border ${
                      doc.startsWith("+")
                        ? "bg-transparent border-dashed border-landing-linea text-landing-gris"
                        : "bg-landing-azul-claro/70 border-landing-azul/20 text-landing-azul-d"
                    }`}
                  >
                    {doc}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Columna 2: ACREDITTIA Hub & Capacidades */}
          <div className="flex flex-col gap-4 bg-white border-2 border-landing-azul/30 rounded-2xl p-6 shadow-md relative overflow-hidden">
            <div className="border-b border-landing-linea pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.72rem] font-bold uppercase tracking-wider text-landing-azul flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-landing-azul animate-pulse" />
                  2. Hub Central ACREDITTIA
                </span>
                <div className="w-9 h-9 rounded-full bg-landing-azul flex items-center justify-center shadow-md">
                  <Image
                    src="/acredittia-mark.svg"
                    alt="ACREDITTIA"
                    width={22}
                    height={22}
                    className="brightness-0 invert"
                  />
                </div>
              </div>
              <h3 className="text-lg font-bold text-landing-ink">
                Todo esto te da ACREDITTIA
              </h3>
            </div>

            <p className="text-xs text-landing-gris leading-relaxed">
              La plataforma valida, mapea faenas y orquesta los requisitos sin recaptura de datos.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {BENEFICIOS_ACREDITTIA.map((ben, idx) => (
                <span
                  key={idx}
                  className="text-[0.78rem] font-bold px-3 py-1.5 rounded-xl bg-landing-naranja-claro/90 border border-landing-naranja/25 text-landing-naranja-d shadow-2xs"
                >
                  {ben}
                </span>
              ))}
            </div>

            <div className="mt-auto pt-4 border-t border-landing-linea/60 text-center">
              <span className="text-xs font-semibold text-landing-azul">
                ⚡ Validación en segundos con IA integrada
              </span>
            </div>
          </div>

          {/* Columna 3: Destinos de Exportación */}
          <div className="flex flex-col gap-5 bg-white border border-landing-linea rounded-2xl p-6 shadow-sm">
            <div className="border-b border-landing-linea pb-3">
              <span className="text-[0.72rem] font-bold uppercase tracking-wider text-landing-azul flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-landing-azul" />
                3. Dónde exporta
              </span>
              <h3 className="text-lg font-bold text-landing-ink mt-1">
                Plataformas de la industria
              </h3>
            </div>

            <p className="text-xs text-landing-gris leading-relaxed">
              Exportación en los formatos exactos exigidos por mandantes y faenas mineras en Chile:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
              {PLATAFORMAS_EXPORT.map((plat, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-landing-linea bg-landing-soft2 hover:bg-white hover:border-landing-azul/40 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-white border border-landing-linea p-1 flex items-center justify-center shrink-0">
                    <Image
                      src={plat.logo}
                      alt={plat.name}
                      width={32}
                      height={32}
                      className="max-h-8 max-w-8 object-contain"
                    />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-landing-ink block">
                      {plat.name}
                    </span>
                    <span className="text-[0.7rem] text-landing-gris">
                      Mapeo y exportación directa
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-landing-linea text-landing-gris font-bold text-xs">
                <span>+</span>
                <span>Y muchas más plataformas del sector</span>
              </div>
            </div>
          </div>
        </div>

        {/* CTA con ancla real a plataforma (R1, H-23) */}
        <div className="text-center mt-12">
          <a
            href={`#${LANDING_SECTIONS.PLATAFORMA}`}
            className="inline-flex items-center gap-2 font-bold text-sm sm:text-base px-6 py-3 rounded-full bg-landing-azul text-white hover:bg-landing-azul-d transition-colors shadow-md hover:shadow-lg"
          >
            Ver cómo funciona en la plataforma →
          </a>
        </div>
      </div>
    </section>
  );
}
