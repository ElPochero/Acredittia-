"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import * as Api from "@/lib/cliente";
import type { Contrato, Documento } from "@/lib/tipos";
import { Barra, Spinner } from "@/components/ui";

// ──────────────────────────────────────────────────────────────────────────────
// Tipos internos
// ──────────────────────────────────────────────────────────────────────────────
interface RequisitoArranque {
  id: string | null;
  ambito: "empresa" | "personal" | "equipo" | "emsipor";
  titulo: string;
  obligatorio: boolean;
  origen: "base" | "custom" | "arranque";
  editable: boolean;
  /** Documento instanciado para este requisito (puede no existir aún) */
  doc?: Documento;
}

interface GrupoAmbito {
  label: string;
  icon: string;
  key: "empresa" | "personal" | "equipo";
}

const GRUPOS: GrupoAmbito[] = [
  { label: "Empresa", icon: "🏢", key: "empresa" },
  { label: "Personal", icon: "👤", key: "personal" },
  { label: "Equipos", icon: "🚛", key: "equipo" },
];

// ──────────────────────────────────────────────────────────────────────────────
// Badge Obligatorio / Opcional
// ──────────────────────────────────────────────────────────────────────────────
function BadgeObl({ obligatorio }: { obligatorio: boolean }) {
  if (obligatorio)
    return (
      <span className="text-[0.55rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] bg-red-50 text-red-600 border border-red-100">
        Obligatorio
      </span>
    );
  return (
    <span className="text-[0.55rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] bg-slate-100 text-slate-500 border border-slate-200">
      Opcional
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Badge "Carpeta de Arranque"
// ──────────────────────────────────────────────────────────────────────────────
function BadgeArranque() {
  return (
    <span className="text-[0.55rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] bg-amber-50 text-amber-700 border border-amber-200">
      Carpeta de Arranque
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Fila de requisito
// ──────────────────────────────────────────────────────────────────────────────
interface FilaProps {
  req: RequisitoArranque;
  contratoId: string;
  onSubir: (docId: string, file: File) => void;
  onEliminar: (id: string) => void;
  onVerDoc: (doc: Documento) => void;
  subiendo: { docId: string; pct: number; texto: string } | null;
  analizandoId: string | null;
}

function FilaRequisito({
  req,
  contratoId,
  onSubir,
  onEliminar,
  onVerDoc,
  subiendo,
  analizandoId,
}: FilaProps) {
  const doc = req.doc;
  const docId = doc?.id ?? "";
  const estado = doc?.estado_calc ?? "falta";
  const isOk = estado === "ok";
  const isPorVenc = estado === "porvenc";
  const isVenc = estado === "venc";
  const cargado = isOk || isPorVenc || isVenc;

  const isSubiendo = !!docId && subiendo?.docId === docId;
  const isAnalizando = !!docId && analizandoId === docId;

  return (
    <div className="relative flex gap-3.5 p-4 rounded-[12px] bg-white border border-slate-200 shadow-sm transition-shadow hover:shadow-md overflow-hidden">
      {/* Overlay subida / análisis */}
      {(isSubiendo || isAnalizando) && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-xl border-2 border-indigo-200">
          {isSubiendo ? (
            <div className="w-64 max-w-full">
              <Barra pct={subiendo!.pct} texto={subiendo!.texto} />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-medium text-indigo-700 animate-pulse">
              <span className="text-xl">🤖</span> Analizando con IA…
            </div>
          )}
        </div>
      )}

      {/* Checkbox de estado */}
      <div
        className={`w-[20px] h-[20px] mt-0.5 rounded-[4px] flex items-center justify-center shrink-0 border transition-colors ${
          cargado
            ? "bg-[#10B981] border-[#10B981] text-white text-[0.7rem] font-bold"
            : "bg-white border-slate-300 text-transparent"
        }`}
      >
        {cargado ? "✓" : ""}
      </div>

      <div className="flex-1 min-w-0">
        {/* Título + badges */}
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <h4 className="text-[0.88rem] font-bold text-[#1E293B] m-0 mr-1">
            {req.titulo}
          </h4>
          <BadgeObl obligatorio={req.obligatorio} />
          <BadgeArranque />
        </div>

        {/* Estado */}
        <div
          className={`text-[0.75rem] font-semibold mb-3 ${
            isOk
              ? "text-[#10B981]"
              : isPorVenc
              ? "text-amber-500"
              : isVenc
              ? "text-red-500"
              : "text-[#b45309]"
          }`}
        >
          {isOk
            ? `✓ Cargado`
            : isPorVenc
            ? `⏰ Por vencer — ${doc?.vence || ""}`
            : isVenc
            ? `⛔ Vencido — ${doc?.vence || ""}`
            : "⏳ Pendiente de carga"}
        </div>

        {/* Acciones */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Subir documento */}
          <label className="h-[28px] px-3 bg-blue-50/50 border border-blue-200 hover:bg-blue-50 rounded-[6px] text-[0.72rem] font-semibold text-blue-600 cursor-pointer flex items-center gap-1.5 transition-colors">
            <span className="text-[0.8rem] leading-none">↑</span> Subir documento
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0] && docId && onSubir) {
                  onSubir(docId, e.target.files[0]);
                  e.target.value = "";
                }
              }}
            />
          </label>

          {/* Si tiene archivo cargado */}
          {cargado && doc && (
            <>
              <button className="h-[28px] px-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-[6px] text-[0.72rem] font-medium text-slate-600 transition-colors flex items-center gap-1">
                📄 {doc.archivos?.[0]?.filename ?? "documento.pdf"}
              </button>
              <button
                onClick={() => doc.archivos?.[0]?.id && onVerDoc(doc)}
                disabled={!doc.archivos?.[0]?.id}
                className="h-[28px] px-3 bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4338CA] rounded-[6px] text-[0.72rem] font-bold transition-colors disabled:opacity-50"
              >
                Ver documento
              </button>
              <button
                onClick={() => doc.archivos?.[0]?.id && onSubir(docId, null as any)}
                disabled={!doc.archivos?.[0]?.id}
                className="h-[28px] px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-[6px] text-[0.72rem] font-bold transition-colors disabled:opacity-50"
              >
                Quitar
              </button>
            </>
          )}

          {/* Eliminar requisito (solo custom/arranque) */}
          {req.editable && req.id && (
            <button
              onClick={() => onEliminar(req.id!)}
              className="ml-auto text-[0.72rem] text-slate-400 hover:text-red-500 transition-colors"
            >
              Eliminar requisito
            </button>
          )}
          {!req.editable && (
            <span className="ml-auto text-[0.68rem] text-slate-300">
              Eliminar requisito
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────────────────────
interface TabCarpetaArranqueProps {
  contrato: Contrato;
  onSubir: (docId: string, file: File) => Promise<void>;
  subiendo: { docId: string; pct: number; texto: string } | null;
  analizandoId: string | null;
}

export function TabCarpetaArranque({
  contrato,
  onSubir,
  subiendo,
  analizandoId,
}: TabCarpetaArranqueProps) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [reqs, setReqs] = useState<RequisitoArranque[]>([]);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [visorDoc, setVisorDoc] = useState<Documento | null>(null);

  // Agregar requisito
  const [nuevaAmbito, setNuevaAmbito] = useState<"empresa" | "personal" | "equipo">("empresa");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const [reqRes, docRes] = await Promise.all([
        Api.contratos.requisitos(contrato.id, {
          vinculo_tipo: "arranque",
          page_size: 100,
        } as any),
        Api.contratos.documentos(contrato.id, { page_size: 100 }),
      ]);

      const docsItems: Documento[] = docRes.items ?? [];
      setDocs(docsItems);

      // Mapear documentos a requisitos por título (matching aproximado)
      const docPorTitulo = new Map<string, Documento>();
      docsItems.forEach((d) => {
        docPorTitulo.set(d.titulo.trim().toLowerCase(), d);
      });

      const items: RequisitoArranque[] = (reqRes.items ?? []).map((r: any) => ({
        id: r.id,
        ambito: r.ambito,
        titulo: r.titulo,
        obligatorio: r.obligatorio,
        origen: r.origen,
        editable: r.editable ?? r.origen !== "base",
        doc: docPorTitulo.get(r.titulo.trim().toLowerCase()),
      }));

      setReqs(items);
    } catch (e) {
      setError(Api.mensajeError(e));
    } finally {
      setCargando(false);
    }
  }, [contrato.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Estadísticas
  const total = reqs.length;
  const cargados = reqs.filter((r) => {
    const e = r.doc?.estado_calc;
    return e === "ok" || e === "porvenc" || e === "venc";
  }).length;
  const pct = total > 0 ? Math.round((cargados / total) * 100) : 0;
  const faltan = reqs.filter(
    (r) =>
      r.obligatorio &&
      (!r.doc || r.doc.estado_calc === "falta")
  );

  const pctColor =
    pct >= 80
      ? "text-[#16a34a]"
      : pct >= 50
      ? "text-[#d97706]"
      : "text-[#dc2626]";

  const handleEliminar = async (id: string) => {
    if (!confirm("¿Eliminar este requisito personalizado?")) return;
    try {
      await Api.contratos.eliminarRequisito(contrato.id, id);
      cargar();
    } catch (e) {
      alert(Api.mensajeError(e));
    }
  };

  const handleAgregar = async () => {
    if (!nuevoNombre.trim()) return alert("El nombre es requerido");
    setGuardando(true);
    try {
      await Api.contratos.crearRequisitos(contrato.id, {
        vinculo_tipo: "arranque",
        ambito: nuevaAmbito,
        titulo: nuevoNombre.trim(),
        obligatorio: true,
        origen: "custom",
      });
      setNuevoNombre("");
      await cargar();
    } catch (e) {
      alert(Api.mensajeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const handleDescargar = async (docId: string, archivoId: string) => {
    try {
      const res = await Api.documentos.urlDescarga(docId, archivoId);
      window.open(res.download_url, "_blank");
    } catch (e) {
      alert(Api.mensajeError(e));
    }
  };

  const handleQuitarArchivo = async (docId: string, archivoId: string) => {
    if (!confirm("¿Eliminar este archivo?")) return;
    try {
      await Api.documentos.eliminarArchivo(docId, archivoId);
      cargar();
    } catch (e) {
      alert(Api.mensajeError(e));
    }
  };

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  // Agrupar por ámbito
  const porAmbito = (key: "empresa" | "personal" | "equipo") =>
    reqs.filter((r) => r.ambito === key);

  return (
    <div className="max-w-[960px] flex flex-col gap-6">
      {/* ── Header con porcentaje ─────────────────────────────────── */}
      <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-[16px] px-5 py-4 shadow-sm">
        <div className="w-[52px] h-[52px] bg-amber-50 border border-amber-200 rounded-[14px] flex items-center justify-center text-[1.5rem] shrink-0">
          📁
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[1rem] text-[#1E293B] font-bold m-0 mb-0.5 leading-tight">
            Carpeta de Arranque — {contrato.faena?.mandante} — {contrato.faena?.nombre}
          </h3>
          <p className="text-[0.78rem] text-slate-500 m-0">
            Documentos que exige el mandante para dar inicio al contrato. No están
            ligados a ninguna plataforma: se entregan como carpeta.
          </p>
          {/* Barra de progreso */}
          <div className="mt-2.5">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  pct >= 80
                    ? "bg-emerald-500"
                    : pct >= 50
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-[1.9rem] font-black leading-none mb-0.5 ${pctColor}`}>
            {cargando ? "—" : `${pct}%`}
          </div>
          <div className="text-[0.72rem] text-slate-500 font-medium">
            {cargados} de {total} cargados
          </div>
        </div>
      </div>

      {/* ── Estado IA ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#0F172A] to-[#1e293b] rounded-[16px] p-5 shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-black text-[0.75rem] shadow-sm">
            IA
          </div>
          <div>
            <div className="text-[0.95rem] text-white font-bold leading-tight">
              Estado de la Carpeta de Arranque
            </div>
            <div className="text-[0.72rem] text-slate-400 mt-0.5">
              Cada documento se revisa con IA al subirlo
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {cargando ? (
            <div className="flex gap-2 items-center p-3 bg-[#1e293b]/80 border border-slate-700/50 rounded-[10px]">
              <span className="text-[0.82rem] text-slate-400">Cargando diagnóstico…</span>
            </div>
          ) : faltan.length > 0 ? (
            <div className="flex gap-3 items-start p-3 bg-[#1e293b]/80 border border-slate-700/50 rounded-[10px]">
              <span className="text-[1rem] shrink-0">📋</span>
              <div className="text-[0.82rem] text-slate-200 leading-snug">
                Faltan{" "}
                <span className="font-bold text-white">
                  {faltan.length} documentos obligatorios
                </span>{" "}
                para completar la carpeta:{" "}
                <span className="text-slate-300">
                  {faltan.map((r) => r.titulo).join(", ")}.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 items-center p-3 bg-[#1e293b]/80 border border-slate-700/50 rounded-[10px]">
              <span className="text-[1rem]">✅</span>
              <div className="text-[0.82rem] text-slate-200 leading-snug">
                La Carpeta de Arranque está completa. Contrato listo para acreditar.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Lista por ámbito ──────────────────────────────────────── */}
      {cargando ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : reqs.length === 0 ? (
        <div className="p-10 text-center text-slate-400 text-[0.85rem] border border-dashed border-slate-200 rounded-xl bg-slate-50">
          No hay requisitos de Carpeta de Arranque configurados para este contrato.
          <br />
          <span className="text-[0.75rem]">
            Agrégalos desde la pestaña «Requisitos» o usa el formulario de abajo.
          </span>
        </div>
      ) : (
        GRUPOS.map(({ label, icon, key }) => {
          const items = porAmbito(key);
          if (items.length === 0) return null;
          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[0.82rem] font-black text-slate-700 uppercase tracking-wider">
                  {icon} {label}
                </span>
                <span className="text-[0.75rem] text-slate-400">
                  ({items.length})
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {items.map((req, idx) => (
                  <FilaRequisito
                    key={req.id ?? `${key}-${idx}`}
                    req={req}
                    contratoId={contrato.id}
                    onSubir={onSubir}
                    onEliminar={handleEliminar}
                    onVerDoc={setVisorDoc}
                    subiendo={subiendo}
                    analizandoId={analizandoId}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* ── Agregar requisito ────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-t border-slate-200 pt-4 mt-2">
        <select
          value={nuevaAmbito}
          onChange={(e) => setNuevaAmbito(e.target.value as any)}
          className="h-[36px] px-3 bg-white border border-slate-200 rounded-[8px] text-[0.82rem] text-slate-700 outline-none shadow-sm cursor-pointer"
        >
          <option value="empresa">Empresa</option>
          <option value="personal">Personal</option>
          <option value="equipo">Equipo</option>
        </select>
        <input
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAgregar()}
          placeholder="Nuevo requisito de la Carpeta…"
          className="flex-1 h-[36px] px-3 bg-white border border-slate-200 rounded-[8px] text-[0.82rem] text-slate-700 outline-none shadow-sm placeholder-slate-400"
        />
        <button
          onClick={handleAgregar}
          disabled={guardando || !nuevoNombre.trim()}
          className="h-[36px] px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-[8px] text-[0.82rem] font-bold transition-colors shadow-sm flex items-center gap-1.5"
        >
          {guardando ? <Spinner /> : "+ Agregar requisito"}
        </button>
      </div>

      {/* Volver */}
      <div className="flex justify-between items-center pt-2">
        <button
          className="text-[0.78rem] text-blue-600 hover:underline font-medium"
          onClick={() => history.back()}
        >
          Volver al listado de contratos
        </button>
        <span className="text-[0.7rem] text-slate-400">
          Creado el {contrato.fecha_inicio ?? "—"} por Administrador
        </span>
      </div>

      {/* ── Visor de documento ───────────────────────────────────── */}
      {visorDoc && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#525252]/90 backdrop-blur-sm p-4"
          onClick={() => setVisorDoc(null)}
        >
          <div
            className="flex flex-col w-full max-w-[800px] h-[90vh] max-h-[800px] bg-[#525252] rounded-xl overflow-hidden shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-white px-6 py-4 flex items-start justify-between shrink-0 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-[1.1rem] font-bold text-slate-800 m-0">
                    {visorDoc.titulo}
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded text-[0.7rem] font-bold ${
                      visorDoc.estado_calc === "ok"
                        ? "bg-emerald-100 text-emerald-700"
                        : visorDoc.estado_calc === "porvenc"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {visorDoc.estado_calc === "ok"
                      ? "Cargado"
                      : visorDoc.estado_calc === "porvenc"
                      ? "Por vencer"
                      : "Falta"}
                  </span>
                </div>
                <div className="text-[0.8rem] text-slate-500">
                  Carpeta de Arranque · {contrato.nombre} —{" "}
                  {visorDoc.archivos?.[0]?.filename ?? "documento.pdf"}
                </div>
              </div>
              <button
                onClick={() => setVisorDoc(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
              >
                <span className="text-[1.2rem] leading-none mb-[2px]">×</span>
              </button>
            </div>

            {/* Cuerpo */}
            <div className="flex-1 p-8 overflow-y-auto flex justify-center w-full">
              <div className="bg-white shadow-lg w-full max-w-[600px] h-fit min-h-[500px] p-8 relative rounded-sm">
                <div className="absolute top-8 right-8 border-[2px] border-emerald-500 text-emerald-600 px-3 py-1 font-bold text-[0.75rem] rotate-12 opacity-80 uppercase tracking-widest rounded-sm bg-white">
                  Validado
                  <br />
                  <span className="text-[0.6rem] block text-center mt-0.5">
                    Vigía IA
                  </span>
                </div>
                <div className="text-[0.65rem] text-slate-400 font-bold uppercase tracking-wider mb-2">
                  Documento
                </div>
                <h3 className="text-[1.3rem] font-black text-slate-800 uppercase m-0 mb-8 pb-4 border-b-2 border-slate-800">
                  {visorDoc.titulo}
                </h3>
                <table className="w-full text-left text-[0.8rem] mb-12">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-3 text-slate-500 w-[140px]">Titular</td>
                      <td className="py-3 font-semibold text-slate-800">
                        Empresa
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-3 text-slate-500">Contrato</td>
                      <td className="py-3 font-semibold text-slate-800">
                        {contrato.nombre}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-3 text-slate-500">Faena</td>
                      <td className="py-3 font-semibold text-slate-800">
                        {contrato.faena?.nombre} · {contrato.faena?.mandante}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-3 text-slate-500">Archivo</td>
                      <td className="py-3 font-semibold text-slate-800">
                        {visorDoc.archivos?.[0]?.filename ?? "documento.pdf"}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="space-y-3 opacity-30">
                  {[100, 83, 100, 67, 91].map((w, i) => (
                    <div
                      key={i}
                      className="h-2 bg-slate-200 rounded-full"
                      style={{ width: `${w}%` }}
                    />
                  ))}
                </div>
                <div className="mt-16 pt-4 border-t border-slate-200 flex justify-between items-end">
                  <div className="w-[120px] h-0 border-t border-slate-800 text-center text-[0.6rem] text-slate-500 pt-1">
                    Firma y timbre
                  </div>
                  <div className="text-[0.65rem] text-slate-400 italic">
                    Vista previa · demo
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white p-4 flex justify-between items-center shrink-0 border-t border-slate-200 rounded-b-xl">
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    visorDoc.archivos?.[0]?.id &&
                    handleDescargar(visorDoc.id, visorDoc.archivos[0].id)
                  }
                  className="h-[36px] px-4 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-[0.8rem] font-bold text-slate-700 flex items-center gap-2 transition-colors"
                >
                  <span className="text-[1rem]">↓</span> Descargar
                </button>
              </div>
              <button
                onClick={() => {
                  if (visorDoc.archivos?.[0]?.id)
                    handleQuitarArchivo(visorDoc.id, visorDoc.archivos[0].id);
                  setVisorDoc(null);
                }}
                className="h-[36px] px-4 bg-white border border-red-200 hover:bg-red-50 rounded-lg text-[0.8rem] font-bold text-red-600 transition-colors"
              >
                Quitar documento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
