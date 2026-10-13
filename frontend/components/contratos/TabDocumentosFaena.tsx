"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import * as Api from "@/lib/cliente";
import type {
  Contrato,
  PlantillaRequisito,
  RequisitoTerreno,
  FaenaDetalle,
  Sujeto,
} from "@/lib/tipos";
import { toast } from "sonner";
import { Modal } from "@/components/ui";

// ──────────────────────────────────────────────────────────────────────────────
// Tipos y datos demo basados en el screenshot de Los Pelambres
// ──────────────────────────────────────────────────────────────────────────────
interface DocumentoFaenaItem {
  id: string;
  titulo: string;
  subidoPor: string;
  tipo: "Estándar" | "Manual" | "Reglamento" | "Protocolo";
  version: string;
  fecha: string;
  requisitosTerrenoCount: number;
  archivoUrl?: string;
  descripcion?: string;
}

interface AlertaTerrenoItem {
  id: string;
  equipoNombre: string;
  patente: string;
  anio: number;
  antiguedadAnios: number;
  maxAnios: number;
  fuente: string;
}

interface GrupoRequisitoIADato {
  tituloDocumento: string;
  requisitos: {
    id: string;
    texto: string;
    resaltado?: string;
    esCritico?: boolean;
  }[];
}

const DOCUMENTOS_DEFAULT: DocumentoFaenaItem[] = [
  {
    id: "doc-1",
    titulo: "Estándar de Vehículos Livianos y Buses — Transporte de Personal",
    subidoPor: "Subido por Mandante",
    tipo: "Estándar",
    version: "Rev. 5",
    fecha: "01 mar 2026",
    requisitosTerrenoCount: 6,
    descripcion:
      "Normativa técnica de seguridad para el transporte de personal dentro del recinto Los Pelambres. Exige límites de antigüedad, equipamiento activo y pasivo.",
  },
  {
    id: "doc-2",
    titulo: "Estándar de Acreditación de Contratistas — Los Pelambres",
    subidoPor: "Subido por Mandante",
    tipo: "Estándar",
    version: "Rev. 7",
    fecha: "15 ene 2026",
    requisitosTerrenoCount: 2,
    descripcion:
      "Procedimiento formal de acreditación laboral, contractual y de seguridad previo al ingreso a faena.",
  },
  {
    id: "doc-3",
    titulo: "Manual de Emergencias y Evacuación",
    subidoPor: "Subido por Mandante",
    tipo: "Manual",
    version: "Rev. 3",
    fecha: "02 mar 2026",
    requisitosTerrenoCount: 1,
    descripcion:
      "Protocolos de respuesta inmediata ante incidentes viales, ambientales o climáticos en faena Los Pelambres.",
  },
];

const ALERTAS_DEFAULT: AlertaTerrenoItem[] = [
  {
    id: "alerta-1",
    equipoNombre: "Bus Marcopolo Paradiso 1050 (46 pasajeros)",
    patente: "SBXC-34",
    anio: 2014,
    antiguedadAnios: 12,
    maxAnios: 10,
    fuente: "Estándar de Vehículos Livianos y Buses — Transporte de Personal",
  },
  {
    id: "alerta-2",
    equipoNombre: "Minibús Mercedes-Benz Sprinter 515 (20 pas.)",
    patente: "SKLW-73",
    anio: 2015,
    antiguedadAnios: 11,
    maxAnios: 10,
    fuente: "Estándar de Vehículos Livianos y Buses — Transporte de Personal",
  },
];

const REQUISITOS_IA_DEFAULT: GrupoRequisitoIADato[] = [
  {
    tituloDocumento: "Estándar de Vehículos Livianos y Buses — Transporte de Personal",
    requisitos: [
      {
        id: "req-1",
        texto: "Antigüedad máxima de vehículos y equipos: ",
        resaltado: "10 años.",
      },
      {
        id: "req-2",
        texto:
          "Todo bus y minibús deberá contar con GPS operativo integrado a la plataforma de monitoreo del mandante.",
      },
      {
        id: "req-3",
        texto: "Todos los asientos deberán contar con cinturón de seguridad de tres puntas.",
      },
      {
        id: "req-4",
        texto:
          "Los vehículos deberán portar extintor vigente, botiquín, dos cuñas y martillos rompevidrios.",
      },
      {
        id: "req-5",
        texto: "La alarma de retroceso y la cámara de retroceso son obligatorias.",
      },
      {
        id: "req-6",
        texto:
          "Las mantenciones deberán realizarse en talleres calificados, anticipándose al 50% del kilometraje indicado por el fabricante.",
      },
    ],
  },
  {
    tituloDocumento: "Estándar de Acreditación de Contratistas — Los Pelambres",
    requisitos: [
      {
        id: "req-7",
        texto: "Todo trabajador debe contar con Inducción Hombre Nuevo antes de ingresar a faena.",
      },
      {
        id: "req-8",
        texto:
          "Los documentos de acreditación se renuevan con al menos 15 días de anticipación a su vencimiento.",
      },
    ],
  },
  {
    tituloDocumento: "Manual de Emergencias y Evacuación",
    requisitos: [
      {
        id: "req-9",
        texto: "Todo vehículo debe portar extintor vigente y botiquín.",
      },
    ],
  },
];

export function TabDocumentosFaena({
  contrato,
  onVerEquipo,
}: {
  contrato: Contrato;
  onVerEquipo?: (patente: string) => void;
}) {
  const [documentos, setDocumentos] = useState<DocumentoFaenaItem[]>(DOCUMENTOS_DEFAULT);
  const [alertas, setAlertas] = useState<AlertaTerrenoItem[]>(ALERTAS_DEFAULT);
  const [requisitosIA, setRequisitosIA] = useState<GrupoRequisitoIADato[]>(REQUISITOS_IA_DEFAULT);

  // Modales
  const [docVer, setDocVer] = useState<DocumentoFaenaItem | null>(null);
  const [equipoModal, setEquipoModal] = useState<AlertaTerrenoItem | null>(null);
  const [modalSubir, setModalSubir] = useState(false);

  // Formulario nuevo documento
  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<"Estándar" | "Manual" | "Reglamento" | "Protocolo">("Estándar");
  const [nuevaVersion, setNuevaVersion] = useState("Rev. 1");
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null);
  const [analizandoNuevo, setAnalizandoNuevo] = useState(false);

  // Nombre de faena dinámico
  const faenaNombre = contrato.faena?.nombre || "Los Pelambres";
  const mandanteNombre = contrato.faena?.mandante || faenaNombre;

  // Totales calculados
  const totalDocs = documentos.length;
  const totalRequisitos = useMemo(() => {
    return requisitosIA.reduce((acc, g) => acc + g.requisitos.length, 0);
  }, [requisitosIA]);
  const totalAlertas = alertas.length;

  const handleQuitarDoc = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;
    if (confirm(`¿Quitar "${doc.titulo}" de los documentos de faena?`)) {
      setDocumentos((prev) => prev.filter((d) => d.id !== id));
      setRequisitosIA((prev) => prev.filter((g) => g.tituloDocumento !== doc.titulo));
      toast.success("Documento removido", {
        description: `Se quitó "${doc.titulo}".`,
      });
    }
  };

  const handleSubirSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTitulo.trim()) {
      toast.error("Ingresa el título del documento");
      return;
    }
    setAnalizandoNuevo(true);

    setTimeout(() => {
      const hoy = new Date().toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      const nuevoDoc: DocumentoFaenaItem = {
        id: `doc-${Date.now()}`,
        titulo: nuevoTitulo.trim(),
        subidoPor: "Subido por Contratista",
        tipo: nuevoTipo,
        version: nuevaVersion.trim() || "Rev. 1",
        fecha: hoy,
        requisitosTerrenoCount: 1,
        descripcion: "Documento procesado por IA de Acredittia. Requisitos extraídos automáticamente.",
      };

      setDocumentos((prev) => [nuevoDoc, ...prev]);
      setRequisitosIA((prev) => [
        {
          tituloDocumento: nuevoDoc.titulo,
          requisitos: [
            {
              id: `req-${Date.now()}`,
              texto: "Cumplimiento obligatorio de las medidas indicadas en el documento.",
              resaltado: "Revisado por IA",
            },
          ],
        },
        ...prev,
      ]);

      setAnalizandoNuevo(false);
      setModalSubir(false);
      setNuevoTitulo("");
      setArchivoSeleccionado(null);
      toast.success("Documento analizado e incorporado", {
        description: `Se detectaron nuevos requisitos de terreno para ${faenaNombre}.`,
      });
    }, 1200);
  };

  return (
    <div className="w-full flex flex-col gap-6 text-slate-800">
      {/* ── BARRA SUPERIOR CONTEXTUAL ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-[0.84rem] text-slate-600 max-w-3xl leading-relaxed m-0">
          Estándares, manuales y reglamentos de{" "}
          <span className="font-semibold text-slate-800">{mandanteNombre}</span>.
          Quedan disponibles para todo el contrato y la IA extrae sus requisitos de terreno para generar alertas.
        </p>

        <button
          onClick={() => setModalSubir(true)}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[0.8rem] rounded-[9px] shadow-sm transition-all"
        >
          <span className="text-[0.95rem] leading-none">+</span> Subir documento de faena
        </button>
      </div>

      {/* ── 3 CONTADORES (CARDS) ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Documentos de faena */}
        <div className="bg-white border border-slate-200/90 rounded-[14px] px-5 py-4 shadow-xs">
          <div className="flex items-center gap-2 text-[0.74rem] text-slate-500 font-medium mb-1">
            <svg
              className="w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span>Documentos de faena</span>
          </div>
          <div className="text-[1.85rem] font-bold text-slate-900 leading-none">
            {totalDocs}
          </div>
        </div>

        {/* Card 2: Requisitos de terreno */}
        <div className="bg-white border border-slate-200/90 rounded-[14px] px-5 py-4 shadow-xs">
          <div className="flex items-center gap-2 text-[0.74rem] text-slate-500 font-medium mb-1">
            <svg
              className="w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <span>Requisitos de terreno</span>
          </div>
          <div className="text-[1.85rem] font-bold text-slate-900 leading-none">
            {totalRequisitos}
          </div>
        </div>

        {/* Card 3: Alertas generadas (Borde y número rojo como en screenshot) */}
        <div className="bg-white border border-red-300 rounded-[14px] px-5 py-4 shadow-xs">
          <div className="flex items-center gap-2 text-[0.74rem] text-slate-500 font-medium mb-1">
            <svg
              className="w-4 h-4 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
            <span>Alertas generadas</span>
          </div>
          <div className="text-[1.85rem] font-bold text-red-600 leading-none">
            {totalAlertas}
          </div>
        </div>
      </div>

      {/* ── CAJA DE ALERTAS POR REQUISITOS DE TERRENO ──────────────────────── */}
      {alertas.length > 0 && (
        <div className="bg-[#FFF5F5] border border-[#FED7D7] rounded-[14px] p-5 shadow-xs">
          <div className="text-[0.68rem] font-black uppercase tracking-wider text-red-600 mb-3.5">
            ALERTAS POR REQUISITOS DE TERRENO
          </div>

          <div className="flex flex-col divide-y divide-red-200/70">
            {alertas.map((a) => (
              <div
                key={a.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-red-500 mt-0.5 text-base select-none shrink-0">
                    ⊘
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.82rem] text-slate-800 leading-snug m-0">
                      <span className="font-bold text-slate-900">{a.equipoNombre}</span>{" "}
                      <span className="text-slate-500">({a.patente})</span> es del año{" "}
                      <span className="font-bold text-red-700">{a.anio}</span>: tiene{" "}
                      <span className="font-bold text-red-700">{a.antiguedadAnios} años</span> y supera la
                      antigüedad máxima de{" "}
                      <span className="font-bold text-red-700">{a.maxAnios} años</span>.
                    </p>
                    <p className="text-[0.72rem] text-slate-500 mt-1 m-0">
                      Fuente: {a.fuente}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (onVerEquipo) {
                      onVerEquipo(a.patente);
                    } else {
                      setEquipoModal(a);
                    }
                  }}
                  className="shrink-0 self-end sm:self-center px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-blue-600 text-[0.74rem] font-semibold rounded-[7px] transition-colors shadow-2xs whitespace-nowrap"
                >
                  Ver equipo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TABLA DE DOCUMENTOS ────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-[14px] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-5">DOCUMENTO</th>
                <th className="py-3.5 px-4">TIPO</th>
                <th className="py-3.5 px-4">VERSIÓN</th>
                <th className="py-3.5 px-4">FECHA</th>
                <th className="py-3.5 px-4">REQUISITOS DE TERRENO</th>
                <th className="py-3.5 px-5 text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[0.82rem]">
              {documentos.map((doc) => (
                <tr
                  key={doc.id}
                  className="hover:bg-slate-50/60 transition-colors group"
                >
                  {/* DOCUMENTO */}
                  <td className="py-4 px-5 align-middle">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 leading-snug">
                          {doc.titulo}
                        </div>
                        <div className="text-[0.72rem] text-slate-500 mt-0.5">
                          {doc.subidoPor}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* TIPO */}
                  <td className="py-4 px-4 align-middle">
                    {doc.tipo === "Manual" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[0.7rem] font-semibold bg-indigo-100 text-indigo-700">
                        Manual
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[0.7rem] font-semibold bg-blue-100 text-blue-700">
                        Estándar
                      </span>
                    )}
                  </td>

                  {/* VERSIÓN */}
                  <td className="py-4 px-4 align-middle text-slate-600 font-normal">
                    {doc.version}
                  </td>

                  {/* FECHA */}
                  <td className="py-4 px-4 align-middle text-slate-600 font-normal">
                    {doc.fecha}
                  </td>

                  {/* REQUISITOS DE TERRENO */}
                  <td className="py-4 px-4 align-middle font-bold text-slate-800">
                    {doc.requisitosTerrenoCount}
                  </td>

                  {/* ACCIONES */}
                  <td className="py-4 px-5 align-middle text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setDocVer(doc)}
                        className="px-3 py-1 bg-blue-50/80 hover:bg-blue-100 border border-blue-200 text-blue-700 text-[0.72rem] font-semibold rounded-[6px] transition-colors"
                      >
                        Ver documento
                      </button>
                      <button
                        onClick={(e) => handleQuitarDoc(doc.id, e)}
                        className="px-2.5 py-1 bg-red-50/80 hover:bg-red-100 border border-red-200 text-red-600 text-[0.72rem] font-semibold rounded-[6px] transition-colors"
                      >
                        Quitar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── REQUISITOS DE TERRENO DETECTADOS POR LA IA ─────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-[14px] p-6 shadow-xs">
        <div className="text-[0.68rem] font-black uppercase tracking-wider text-slate-700 mb-5">
          REQUISITOS DE TERRENO DETECTADOS POR LA IA
        </div>

        <div className="flex flex-col gap-6">
          {requisitosIA.map((grupo) => (
            <div key={grupo.tituloDocumento} className="flex flex-col gap-2.5">
              <h4 className="text-[0.83rem] font-bold text-blue-700 hover:underline cursor-pointer m-0">
                {grupo.tituloDocumento}
              </h4>

              <ul className="space-y-1.5 pl-3 m-0 list-none">
                {grupo.requisitos.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start gap-2.5 text-[0.79rem] text-slate-700 leading-snug"
                  >
                    <span className="text-slate-400 select-none mt-1 text-[0.65rem] shrink-0">
                      •
                    </span>
                    <div>
                      <span>{r.texto}</span>
                      {r.resaltado && (
                        <span className="font-bold text-slate-900">
                          {r.resaltado}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER VOLVER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 text-[0.78rem]">
        <button
          onClick={() => history.back()}
          className="text-blue-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
        >
          ← Volver al listado de contratos
        </button>
        <span className="text-slate-400 text-[0.74rem]">
          Creado el 01/01/2024 por Administrador
        </span>
      </div>

      {/* ── MODAL VER DOCUMENTO ────────────────────────────────────────────── */}
      <Modal
        abierto={!!docVer}
        titulo={docVer?.titulo || "Detalle del Documento"}
        onCerrar={() => setDocVer(null)}
        ancho="max-w-2xl"
      >
        {docVer && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100">
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                {docVer.tipo}
              </span>
              <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                {docVer.version}
              </span>
              <span className="text-xs text-slate-500">
                Emitido el {docVer.fecha}
              </span>
              <span className="text-xs text-slate-400 ml-auto">
                {docVer.subidoPor}
              </span>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              {docVer.descripcion ||
                "Este documento rige para todas las operaciones contratadas bajo la faena correspondiente."}
            </p>

            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <h5 className="text-xs font-bold uppercase tracking-wider text-blue-900 mb-2">
                Requisitos extraídos por IA ({docVer.requisitosTerrenoCount})
              </h5>
              <p className="text-xs text-slate-600 mb-2">
                El motor de análisis de documentos inspecciona cláusulas mandatorias,
                vigencias y estándares aplicables a vehículos y colaboradores.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  toast.info("Descarga iniciada", {
                    description: `Descargando copia de ${docVer.titulo}`,
                  });
                }}
                className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Descargar PDF
              </button>
              <button
                type="button"
                onClick={() => setDocVer(null)}
                className="btn-primary text-sm px-5 py-2"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL VER EQUIPO / ALERTA ──────────────────────────────────────── */}
      <Modal
        abierto={!!equipoModal}
        titulo={`Detalle de Alerta: ${equipoModal?.equipoNombre || ""}`}
        onCerrar={() => setEquipoModal(null)}
        ancho="max-w-lg"
      >
        {equipoModal && (
          <div className="space-y-4">
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-900 space-y-2">
              <div className="font-bold flex items-center gap-2 text-red-700">
                <span>⊘</span> Antigüedad máxima superada
              </div>
              <p className="text-xs text-red-800 leading-relaxed">
                El vehículo con patente <span className="font-bold">{equipoModal.patente}</span> fue
                fabricado en <span className="font-bold">{equipoModal.anio}</span> y tiene{" "}
                <span className="font-bold">{equipoModal.antiguedadAnios} años</span> de antigüedad.
                El estándar de faena exige un límite de{" "}
                <span className="font-bold">{equipoModal.maxAnios} años</span> para el transporte de personal.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 text-xs space-y-1.5 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Patente:</span>
                <span className="font-bold text-slate-800">{equipoModal.patente}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Año de fabricación:</span>
                <span className="font-bold text-slate-800">{equipoModal.anio}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Norma aplicable:</span>
                <span className="font-medium text-slate-700">{equipoModal.fuente}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEquipoModal(null)}
                className="btn-primary text-sm px-5 py-2"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL SUBIR DOCUMENTO DE FAENA ─────────────────────────────────── */}
      <Modal
        abierto={modalSubir}
        titulo={`Subir documento de faena para ${faenaNombre}`}
        onCerrar={() => {
          if (!analizandoNuevo) setModalSubir(false);
        }}
        ancho="max-w-xl"
      >
        <form onSubmit={handleSubirSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Nombre o Título del Documento
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Estándar Operacional de Transporte Escoltado"
              value={nuevoTitulo}
              onChange={(e) => setNuevoTitulo(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Tipo
              </label>
              <select
                value={nuevoTipo}
                onChange={(e) => setNuevoTipo(e.target.value as any)}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600 bg-white"
              >
                <option value="Estándar">Estándar</option>
                <option value="Manual">Manual</option>
                <option value="Reglamento">Reglamento</option>
                <option value="Protocolo">Protocolo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Versión / Revisión
              </label>
              <input
                type="text"
                placeholder="Rev. 1"
                value={nuevaVersion}
                onChange={(e) => setNuevaVersion(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Archivo PDF
            </label>
            <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-5 text-center cursor-pointer transition-colors bg-slate-50/50">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                id="docFaenaInput"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setArchivoSeleccionado(f);
                }}
              />
              <label htmlFor="docFaenaInput" className="cursor-pointer block">
                <svg
                  className="w-8 h-8 mx-auto text-slate-400 mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <span className="text-xs font-semibold text-blue-600 hover:underline">
                  {archivoSeleccionado
                    ? archivoSeleccionado.name
                    : "Haz clic para seleccionar o arrastra un PDF"}
                </span>
                <p className="text-[0.72rem] text-slate-400 mt-1">
                  Formatos soportados: PDF, DOCX (Máx. 25MB)
                </p>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={analizandoNuevo}
              onClick={() => setModalSubir(false)}
              className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={analizandoNuevo}
              className="btn-primary text-sm px-5 py-2 flex items-center gap-2"
            >
              {analizandoNuevo ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analizando con IA…
                </>
              ) : (
                "Subir y analizar con IA"
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
