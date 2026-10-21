"use client";

import React from "react";
import Image from "next/image";
import useReveal from "./useReveal";
import { LANDING_SECTIONS } from "./sections";

/**
 * LandingFlujo — Sección de flujo detallado paso a paso (6 pasos).
 * Cumple con R2, H-47, H-17 y H-14:
 * - Cero botones disabled decorativos.
 * - Cero opciones preseleccionadas falsamente interactivas; se presentan como formatos y chips informativos de estado.
 * - No introduce cursor-pointer en elementos sin acción real.
 * - Animaciones escalonadas con useReveal.
 * 
 * Referencia HTML: líneas 1142-1313.
 */
export default function LandingFlujo() {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section
      id={LANDING_SECTIONS.FLUJO}
      ref={sectionRef}
      className="py-20 lg:py-28 px-[6%] bg-white border-b border-landing-linea scroll-mt-20"
    >
      <div className="max-w-[760px] mx-auto">
        {/* Cabecera de la sección */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center justify-center gap-2 text-[0.72rem] tracking-wider uppercase font-bold text-landing-azul bg-landing-azul-claro px-3.5 py-1.5 rounded-full mb-4">
            <span className="w-2 h-2 rounded-full bg-landing-azul" />
            PASO A PASO
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-[2.2rem] font-extrabold text-landing-ink tracking-tight mb-3">
            Así se acredita a una persona o un equipo, de principio a fin
          </h2>
          <p className="text-landing-gris text-base sm:text-lg max-w-[640px] mx-auto leading-relaxed">
            Desde que creas el contrato hasta que subes todo a la plataforma del mandante.
            Sin planillas, sin buscar correos antiguos.
          </p>
        </div>

        {/* Lista de pasos con línea vertical continua */}
        <div className="flex flex-col">
          {/* PASO 1 */}
          <div className="relative grid grid-cols-[36px_1fr] sm:grid-cols-[44px_1fr] gap-4 sm:gap-6 pb-12">
            <div className="flex flex-col items-center">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-landing-azul text-white font-extrabold text-sm sm:text-base flex items-center justify-center shrink-0 z-10 shadow-sm">
                1
              </div>
              <div className="w-0.5 flex-1 bg-landing-linea mt-2" />
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-landing-ink mb-1.5">
                Creas el contrato
              </h3>
              <p className="text-landing-gris text-sm sm:text-[0.95rem] leading-relaxed mb-4">
                Eliges la faena, el proveedor y la plataforma con la que trabaja. El contrato queda armado en segundos.
              </p>

              <div className="bg-white border border-landing-linea rounded-2xl p-5 shadow-landing-card">
                <div className="divide-y divide-landing-linea text-sm">
                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-landing-gris">Faena</span>
                    <span className="font-bold text-landing-ink">Los Pelambres</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-landing-gris">Proveedor</span>
                    <span className="font-bold text-landing-ink">Proveedor SpA</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-landing-gris">Plataforma</span>
                    <span className="font-bold text-landing-ink">SIGA</span>
                  </div>
                </div>

                {/* H-47: Sin botón disabled decorativo. Chip informativo de estado */}
                <div className="mt-4 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-landing-azul bg-landing-azul-claro/80 border border-blue-200/50">
                  <span className="text-sm">⚡</span>
                  <span>Mapeo instantáneo de faena y plataforma configurado</span>
                </div>
              </div>

              <div className="mt-3.5 flex items-start gap-2.5 bg-landing-soft rounded-xl p-3 sm:p-3.5 text-xs sm:text-[0.82rem] text-landing-gris leading-relaxed border border-blue-100/60">
                <span className="shrink-0 text-base">🏭</span>
                <p>
                  <strong className="text-landing-ink">¿Es una faena integrada?</strong> Apenas creas el contrato te aparecen altiro las plataformas que usa y los requisitos de cada una. ¿No está integrada? Sigues el mismo flujo: la creas y defines los requisitos en el paso siguiente.
                </p>
              </div>
            </div>
          </div>

          {/* PASO 2 */}
          <div className="relative grid grid-cols-[36px_1fr] sm:grid-cols-[44px_1fr] gap-4 sm:gap-6 pb-12">
            <div className="flex flex-col items-center">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-landing-azul text-white font-extrabold text-sm sm:text-base flex items-center justify-center shrink-0 z-10 shadow-sm">
                2
              </div>
              <div className="w-0.5 flex-1 bg-landing-linea mt-2" />
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-landing-ink mb-1.5">
                Defines los requisitos con IA
              </h3>
              <p className="text-landing-gris text-sm sm:text-[0.95rem] leading-relaxed mb-4">
                Le cuentas a la IA qué pide esa plataforma, como en un chat, y ella te los deja armados como checklist. Tú los ajustas si falta algo.
              </p>

              <div className="bg-white border border-landing-linea rounded-2xl p-5 shadow-landing-card">
                <div className="flex items-center gap-2 text-xs font-bold text-landing-ink pb-3 mb-3 border-b border-landing-linea">
                  <span className="w-2 h-2 rounded-full bg-landing-verde" />
                  Asistente ACREDITTIA
                </div>

                <div className="flex flex-col gap-2.5 mb-4 text-xs sm:text-[0.82rem]">
                  <div className="self-start max-w-[88%] bg-landing-soft text-landing-ink p-3 rounded-2xl rounded-tl-sm border border-slate-100 leading-relaxed">
                    Te subo los requisitos de SIGA: captura de pantalla con lo que piden para Empresa, Personal y Equipos (varían según el tipo de carga o equipo).
                  </div>
                  <div className="self-end max-w-[88%] bg-landing-azul text-white p-3 rounded-2xl rounded-tr-sm leading-relaxed shadow-sm">
                    Listo, los mapeé como checklist separado por Empresa, Personal y Equipos. Puedes agregar o quitar los que necesites.
                  </div>
                </div>

                <div className="pt-3.5 border-t border-dashed border-landing-linea space-y-3">
                  <div>
                    <span className="block text-[0.68rem] font-bold uppercase tracking-wider text-landing-gris mb-1.5">
                      Empresa
                    </span>
                    <div className="flex items-center justify-between text-xs py-1.5 px-3 bg-slate-50/70 rounded-lg">
                      <span className="text-landing-ink font-medium">Certificado de accidentabilidad</span>
                      <span className="text-[0.7rem] font-semibold text-landing-verde bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Agregado
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="block text-[0.68rem] font-bold uppercase tracking-wider text-landing-gris mb-1.5">
                      Personal
                    </span>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs py-1.5 px-3 bg-slate-50/70 rounded-lg">
                        <span className="text-landing-ink font-medium">Licencia de conducir</span>
                        <span className="text-[0.7rem] font-semibold text-landing-verde bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Agregado
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs py-1.5 px-3 bg-slate-50/70 rounded-lg">
                        <span className="text-landing-ink font-medium">Examen ELA</span>
                        <span className="text-[0.7rem] font-semibold text-landing-verde bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Agregado
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="block text-[0.68rem] font-bold uppercase tracking-wider text-landing-gris mb-1.5">
                      Equipos
                    </span>
                    <div className="flex items-center justify-between text-xs py-1.5 px-3 bg-slate-50/70 rounded-lg">
                      <span className="text-landing-ink font-medium">Revisión técnica</span>
                      <span className="text-[0.7rem] font-semibold text-landing-verde bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Agregado
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 flex items-start gap-2.5 bg-landing-soft rounded-xl p-3 sm:p-3.5 text-xs sm:text-[0.82rem] text-landing-gris leading-relaxed border border-blue-100/60">
                <span className="shrink-0 text-base">💡</span>
                <p>
                  <strong className="text-landing-ink">¿Faena ya integrada con ACREDITTIA?</strong> Este paso se salta solo: los requisitos aparecen automáticamente porque ya los acordamos con el mandante.
                </p>
              </div>
            </div>
          </div>

          {/* PASO 3 */}
          <div className="relative grid grid-cols-[36px_1fr] sm:grid-cols-[44px_1fr] gap-4 sm:gap-6 pb-12">
            <div className="flex flex-col items-center">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-landing-azul text-white font-extrabold text-sm sm:text-base flex items-center justify-center shrink-0 z-10 shadow-sm">
                3
              </div>
              <div className="w-0.5 flex-1 bg-landing-linea mt-2" />
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-landing-ink mb-1.5">
                Subes cada documento
              </h3>
              <p className="text-landing-gris text-sm sm:text-[0.95rem] leading-relaxed mb-4">
                Subes el documento a cada requisito. La IA detecta lo que falta y mapea sola la vigencia de cada uno.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Persona */}
                <div className="bg-white border border-landing-linea rounded-2xl p-4 shadow-landing-card">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-slate-200 bg-slate-100 relative">
                      <Image
                        src="/trab_rodrigo.jpg"
                        alt="Rodrigo Soto"
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <b className="block text-sm font-bold text-landing-ink">Rodrigo Soto</b>
                      <span className="text-xs text-landing-gris">Conductor · Los Pelambres</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-landing-linea/60">
                      <span className="text-landing-ink">Licencia de conducir</span>
                      <span className="text-[0.68rem] font-bold text-landing-verde bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Vigente
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-landing-linea/60">
                      <span className="text-landing-ink">Examen ELA</span>
                      <span className="text-[0.68rem] font-bold text-landing-ambar bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Vence en 30 días
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-landing-ink">Psicosensotécnico</span>
                      <span className="text-[0.68rem] font-bold text-landing-rojo bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        Falta subir
                      </span>
                    </div>
                  </div>
                </div>

                {/* Equipo */}
                <div className="bg-white border border-landing-linea rounded-2xl p-4 shadow-landing-card">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-slate-200 bg-slate-100 relative">
                      <Image
                        src="/tipo_camionpluma2.jpg"
                        alt="Camión Pluma 330"
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <b className="block text-sm font-bold text-landing-ink">Camión Pluma 330</b>
                      <span className="text-xs text-landing-gris">Equipo · Los Pelambres</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-landing-linea/60">
                      <span className="text-landing-ink">Revisión técnica</span>
                      <span className="text-[0.68rem] font-bold text-landing-ambar bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Vence en 12 días
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-landing-linea/60">
                      <span className="text-landing-ink">Certificación de grúa</span>
                      <span className="text-[0.68rem] font-bold text-landing-verde bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Vigente
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-landing-ink">Seguro obligatorio (SOAP)</span>
                      <span className="text-[0.68rem] font-bold text-landing-rojo bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        Falta subir
                      </span>
                    </div>
                  </div>
                </div>

                {/* Empresa */}
                <div className="sm:col-span-2 bg-white border border-landing-linea rounded-2xl p-4 shadow-landing-card">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-lg">
                      🏢
                    </div>
                    <div>
                      <b className="block text-sm font-bold text-landing-ink">Proveedor SpA</b>
                      <span className="text-xs text-landing-gris">Empresa · Los Pelambres</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center justify-between py-1.5 px-2.5 bg-slate-50/70 rounded-lg">
                      <span className="text-landing-ink">Tasa accidentabilidad</span>
                      <span className="text-[0.68rem] font-bold text-landing-verde bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Vigente
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 px-2.5 bg-slate-50/70 rounded-lg">
                      <span className="text-landing-ink">Certificado F30-1</span>
                      <span className="text-[0.68rem] font-bold text-landing-ambar bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Vence en 8 días
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 px-2.5 bg-slate-50/70 rounded-lg">
                      <span className="text-landing-ink">Póliza resp. civil</span>
                      <span className="text-[0.68rem] font-bold text-landing-rojo bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        Falta subir
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PASO 4 */}
          <div className="relative grid grid-cols-[36px_1fr] sm:grid-cols-[44px_1fr] gap-4 sm:gap-6 pb-12">
            <div className="flex flex-col items-center">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-landing-azul text-white font-extrabold text-sm sm:text-base flex items-center justify-center shrink-0 z-10 shadow-sm">
                4
              </div>
              <div className="w-0.5 flex-1 bg-landing-linea mt-2" />
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-landing-ink mb-1.5">
                Exportas en el formato que quieras
              </h3>
              <p className="text-landing-gris text-sm sm:text-[0.95rem] leading-relaxed mb-4">
                Cuando ya tienes todo cargado, eliges cómo te sirve descargarlo: en carpetas por requisito, o en un solo archivo con todo junto.
              </p>

              <div className="bg-white border border-landing-linea rounded-2xl p-5 shadow-landing-card">
                {/* H-47: Formatos disponibles presentados como opciones soportadas */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-start gap-3.5 border-1.5 border-landing-azul bg-landing-azul-claro/50 rounded-xl p-3.5">
                    <span className="text-2xl shrink-0">🗂️</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <b className="text-sm font-bold text-landing-ink">Carpetas por requisito</b>
                        <span className="text-[0.68rem] font-bold text-landing-azul bg-blue-100/80 px-2 py-0.5 rounded-full">
                          Soportado
                        </span>
                      </div>
                      <span className="block text-xs text-landing-gris mt-0.5">
                        Estructura ZIP lista para subir a plataformas por carpetas individuales
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5 border border-landing-linea bg-slate-50/60 rounded-xl p-3.5">
                    <span className="text-2xl shrink-0">📎</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <b className="text-sm font-bold text-landing-ink">Un solo archivo PDF consolidado</b>
                        <span className="text-[0.68rem] font-bold text-landing-gris bg-slate-200/70 px-2 py-0.5 rounded-full">
                          Soportado
                        </span>
                      </div>
                      <span className="block text-xs text-landing-gris mt-0.5">
                        Todos los documentos foliados y ordenados en un único archivo
                      </span>
                    </div>
                  </div>
                </div>

                {/* H-47: Sin botón fake. Estado de preparación listo */}
                <div className="flex items-center justify-between text-xs text-landing-gris bg-slate-50 border border-landing-linea rounded-xl px-4 py-2.5">
                  <span className="font-medium">✓ Empaquetado automático con nomenclatura requerida</span>
                  <span className="font-bold text-landing-ink">Listo en 1 clic</span>
                </div>
              </div>
            </div>
          </div>

          {/* PASO 5 */}
          <div className="relative grid grid-cols-[36px_1fr] sm:grid-cols-[44px_1fr] gap-4 sm:gap-6 pb-12">
            <div className="flex flex-col items-center">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-landing-azul text-white font-extrabold text-sm sm:text-base flex items-center justify-center shrink-0 z-10 shadow-sm">
                5
              </div>
              <div className="w-0.5 flex-1 bg-landing-linea mt-2" />
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-landing-ink mb-1.5">
                Subes a la plataforma del mandante
              </h3>
              <p className="text-landing-gris text-sm sm:text-[0.95rem] leading-relaxed mb-4">
                Descargas el archivo y lo subes donde tu mandante lo pida. Lo marcas como{" "}
                <b className="text-landing-ink">SUBIDO A PLATAFORMA</b> y, cuando lo aprueban, lo pasas a{" "}
                <b className="text-landing-ink">APROBADO</b> en ACREDITTIA. Desde ahí le das seguimiento a todo, solo desde la plataforma.
              </p>

              <div className="bg-white border border-landing-linea rounded-2xl p-6 shadow-landing-card">
                <div className="flex items-center justify-center gap-3 sm:gap-4 mb-5 text-sm sm:text-base">
                  <span className="font-bold text-landing-azul bg-landing-azul-claro px-3.5 py-1.5 rounded-full border border-blue-200">
                    ACREDITTIA
                  </span>
                  <span className="text-landing-gris font-bold">→</span>
                  <span className="font-bold text-landing-ink bg-slate-100 px-3.5 py-1.5 rounded-full border border-slate-200">
                    SUCAL
                  </span>
                </div>

                <div className="flex items-center justify-center gap-3 text-xs sm:text-sm">
                  <span className="inline-flex items-center gap-1.5 font-bold text-landing-ambar bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                    📤 Subido a plataforma
                  </span>
                  <span className="text-landing-gris font-bold">→</span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-landing-verde bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
                    ✅ Aprobado
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* PASO 6 */}
          <div className="relative grid grid-cols-[36px_1fr] sm:grid-cols-[44px_1fr] gap-4 sm:gap-6">
            <div className="flex flex-col items-center">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-landing-azul text-white font-extrabold text-sm sm:text-base flex items-center justify-center shrink-0 z-10 shadow-sm">
                6
              </div>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-landing-ink mb-1.5">
                Tu contrato queda en la plataforma, siempre al día
              </h3>
              <p className="text-landing-gris text-sm sm:text-[0.95rem] leading-relaxed mb-4">
                El contrato te queda armado en ACREDITTIA y ves de un vistazo el estado de todo. ¿Entra gente nueva o un equipo nuevo? Los requisitos ya están mapeados, así que la plataforma ya sabe qué pedirte, y te avisa antes de cada vencimiento y cuando falta subir un documento.
              </p>

              <div className="bg-white border border-landing-linea rounded-2xl p-5 shadow-landing-card space-y-4">
                {/* Cabecera del contrato */}
                <div className="flex items-center justify-between pb-3 border-b border-landing-linea">
                  <div>
                    <b className="block text-sm sm:text-base font-bold text-landing-ink">MLP Operaciones</b>
                    <span className="text-xs text-landing-gris">Los Pelambres · SIGA</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-landing-verde">
                    92%
                  </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-4 gap-2 text-center py-2 bg-slate-50/70 rounded-xl">
                  <div>
                    <b className="block text-base sm:text-lg font-bold text-[#16A34A]">9</b>
                    <span className="text-[0.68rem] text-landing-gris font-medium">Acreditados</span>
                  </div>
                  <div>
                    <b className="block text-base sm:text-lg font-bold text-[#1D4ED8]">2</b>
                    <span className="text-[0.68rem] text-landing-gris font-medium">En proceso</span>
                  </div>
                  <div>
                    <b className="block text-base sm:text-lg font-bold text-[#BC7627]">1</b>
                    <span className="text-[0.68rem] text-landing-gris font-medium">Vencidos</span>
                  </div>
                  <div>
                    <b className="block text-base sm:text-lg font-bold text-[#BE3A3F]">0</b>
                    <span className="text-[0.68rem] text-landing-gris font-medium">Bloqueados</span>
                  </div>
                </div>

                {/* Nuevo trabajador */}
                <div className="p-3.5 bg-slate-50/60 rounded-xl border border-landing-linea/60">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-slate-200 bg-slate-100 relative">
                      <Image
                        src="/trab_matias.jpg"
                        alt="Matías Rojas"
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <b className="block text-sm font-bold text-landing-ink truncate">Matías Rojas</b>
                      <span className="text-xs text-landing-gris">Nuevo trabajador · Operador</span>
                    </div>
                    <span className="hidden sm:inline-block text-[0.68rem] font-bold text-landing-azul bg-landing-azul-claro px-2.5 py-1 rounded-full whitespace-nowrap">
                      + Requisitos mapeados
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-landing-linea/60">
                      <span className="text-landing-ink">Licencia de conducir</span>
                      <span className="text-[0.68rem] font-bold text-landing-verde bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Vigente
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-landing-linea/60">
                      <span className="text-landing-ink">Examen ocupacional</span>
                      <span className="text-[0.68rem] font-bold text-landing-verde bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Vigente
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-landing-ink">Psicosensotécnico</span>
                      <span className="text-[0.68rem] font-bold text-landing-rojo bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        Falta subir
                      </span>
                    </div>
                  </div>
                </div>

                {/* Alertas generadas */}
                <div className="space-y-2 pt-1 text-xs">
                  <div className="flex items-center justify-between p-2.5 bg-amber-50/50 rounded-xl border border-amber-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm shrink-0">⏰</span>
                      <span className="text-landing-ink truncate">
                        Examen ELA de <b>José Toro</b> vence en 15 días
                      </span>
                    </div>
                    <small className="text-[0.68rem] font-bold text-landing-ambar whitespace-nowrap ml-2">
                      Alerta enviada
                    </small>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-rose-50/40 rounded-xl border border-rose-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm shrink-0">📄</span>
                      <span className="text-landing-ink truncate">
                        Falta subir psicosensotécnico de <b>Matías Rojas</b>
                      </span>
                    </div>
                    <small className="text-[0.68rem] font-bold text-landing-rojo whitespace-nowrap ml-2">
                      Alerta enviada
                    </small>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-amber-50/50 rounded-xl border border-amber-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm shrink-0">🚛</span>
                      <span className="text-landing-ink truncate">
                        Revisión técnica de <b>Camión Pluma 330</b> vence en 12 días
                      </span>
                    </div>
                    <small className="text-[0.68rem] font-bold text-landing-ambar whitespace-nowrap ml-2">
                      Alerta enviada
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
