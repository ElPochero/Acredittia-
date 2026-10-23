"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui";
import { toast } from "sonner";
import * as Api from "@/lib/cliente";
import type {
  ArbolExportacion, Contrato, EstructuraExport, PlataformaContrato,
  SeccionExport,
} from "@/lib/tipos";

/**
 * Exportación documental en ZIP por plataforma de destino (H-20, H-29).
 *
 * La vista previa la calcula el backend y el ZIP sale del mismo plan, así que
 * los contadores y el árbol que se ven aquí son el archivo que se descarga.
 * La plataforma elegida solo nombra la raíz (`CT-XXX_SIGA.zip`): los documentos
 * no se filtran por ella porque únicamente las plantillas EMSIPOR la declaran.
 */

const PLATAFORMAS_POR_DEFECTO = ["SIGA", "DIRECTIC", "SGES", "Academia MLP", "EMSIPOR"];

const SECCIONES: {
  clave: SeccionExport; titulo: string; icono: string; ayuda: string;
}[] = [
  { clave: "empresa", titulo: "Empresa", icono: "🏢", ayuda: "Documentos del contrato, no de personas" },
  { clave: "personal", titulo: "Personal", icono: "👷", ayuda: "Una carpeta por trabajador" },
  { clave: "equipos", titulo: "Equipos", icono: "🚛", ayuda: "Una carpeta por vehículo o máquina" },
  { clave: "licencia", titulo: "Licencia Interna", icono: "🪪", ayuda: "Documentos de la licencia interna" },
];

const ESTRUCTURAS: { valor: EstructuraExport; etiqueta: string }[] = [
  { valor: "sueltos", etiqueta: "📄 Archivos sueltos" },
  { valor: "carpetas", etiqueta: "📁 Carpetas por sujeto" },
  { valor: "pdf", etiqueta: "📕 PDF unido por ficha" },
];

interface ExportarDocumentosModalProps {
  abierto: boolean;
  onCerrar: () => void;
  /** Sin contrato se exporta la empresa completa (raíz `EMPRESA_<PLATAFORMA>`). */
  contrato?: Contrato | null;
  plataformas?: PlataformaContrato[];
}

export function ExportarDocumentosModal({
  abierto, onCerrar, contrato, plataformas,
}: ExportarDocumentosModalProps) {
  const opciones = useMemo(() => {
    const nombres = (plataformas ?? []).map((p) => p.nombre).filter(Boolean);
    return nombres.length ? nombres : PLATAFORMAS_POR_DEFECTO;
  }, [plataformas]);

  const [plataforma, setPlataforma] = useState(opciones[0]);
  const [marcadas, setMarcadas] = useState<Record<SeccionExport, boolean>>({
    empresa: true, personal: true, equipos: true, licencia: false,
  });
  const [estructuras, setEstructuras] = useState<Record<SeccionExport, EstructuraExport>>({
    empresa: "sueltos", personal: "carpetas", equipos: "pdf", licencia: "carpetas",
  });
  const [soloVigentes, setSoloVigentes] = useState(true);
  const [preview, setPreview] = useState<ArbolExportacion | null>(null);
  const [cargando, setCargando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [descargado, setDescargado] = useState<string | null>(null);
  const [marcando, setMarcando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setPlataforma((p) => (opciones.includes(p) ? p : opciones[0]));
    setPreview(null);
    setDescargado(null);
    setError(null);
    // Las secciones y estructuras elegidas se conservan entre aperturas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const incluidas = SECCIONES.filter((s) => marcadas[s.clave]);
  const incluir = incluidas.map((s) => s.clave).join(",");
  const estructura = incluidas
    .map((s) => `${s.clave}:${estructuras[s.clave]}`)
    .join(",");

  const params = useMemo<Api.ParamsExportar>(() => ({
    contrato_id: contrato?.id,
    plataforma,
    incluir,
    estructura,
    solo_vigentes: soloVigentes,
  }), [contrato?.id, plataforma, incluir, estructura, soloVigentes]);

  useEffect(() => {
    if (!abierto) return;
    if (!incluir) {
      setPreview(null);
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    const timer = setTimeout(() => {
      Api.exportar.arbol(params)
        .then((p) => {
          if (cancelado) return;
          setPreview(p);
          setError(null);
        })
        .catch((e) => {
          if (cancelado) return;
          setPreview(null);
          setError(Api.mensajeError(e));
        })
        .finally(() => { if (!cancelado) setCargando(false); });
    }, 250);
    return () => { cancelado = true; clearTimeout(timer); };
  }, [abierto, params, incluir]);

  /** Carpetas y archivos en orden, para pintar el árbol con sangría. */
  const lineas = useMemo(() => {
    const vistas = new Set<string>();
    const salida: { texto: string; nivel: number; carpeta: boolean }[] = [];
    for (const ruta of preview?.rutas ?? []) {
      const partes = ruta.split("/");
      for (let i = 1; i < partes.length; i++) {
        const dir = partes.slice(0, i).join("/");
        if (vistas.has(dir)) continue;
        vistas.add(dir);
        salida.push({ texto: partes[i - 1], nivel: i - 1, carpeta: true });
      }
      salida.push({ texto: partes[partes.length - 1], nivel: partes.length - 1, carpeta: false });
    }
    return salida;
  }, [preview]);

  const plataformaElegida = plataformas?.find((p) => p.nombre === plataforma);
  const pid = plataformaElegida
    ? plataformaElegida.id || plataformaElegida.faena_plataforma_id || null
    : null;

  const cerrar = () => { setError(null); onCerrar(); };

  const descargar = async () => {
    if (!preview?.total_archivos || descargando) return;
    setDescargando(true);
    setError(null);
    try {
      const { blob, filename } = await Api.exportar.zip(params);
      const url = URL.createObjectURL(blob);
      Api.abrirDescarga(url, filename);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDescargado(filename);
    } catch (e) {
      setError(Api.mensajeError(e));
    } finally {
      setDescargando(false);
    }
  };

  const marcarSubido = async () => {
    if (!contrato || !pid || marcando) return;
    setMarcando(true);
    try {
      const res = await Api.plataformas.marcarSubida(contrato.id, pid);
      toast.success("Marcado como subido", {
        description: `Documentos subidos a ${res.plataforma}.`,
      });
    } catch (e) {
      toast.error("No se pudo marcar", { description: Api.mensajeError(e) });
    } finally {
      setMarcando(false);
    }
  };

  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo="" ancho="max-w-[960px]">
      <div className="flex items-center gap-3 mb-4">
        <span aria-hidden="true" className="w-[42px] h-[42px] rounded-xl bg-indigo-50 grid place-items-center text-[1.3rem] flex-shrink-0">📦</span>
        <div>
          <h3 className="m-0 text-[1.1rem] font-bold text-slate-900">Exportar documentos</h3>
          <p className="m-0 text-[0.8rem] text-slate-500">
            {contrato ? `${contrato.codigo || contrato.nombre} · ${contrato.nombre}` : "Toda la empresa"}
            {" — "}listos para subirlos a la plataforma del mandante
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-5">
        <div className="flex-1 min-w-0">
          <div className="text-[0.72rem] font-bold uppercase tracking-wider text-slate-500 mb-2">1 · Plataforma de destino</div>
          <div className="flex gap-1.5 flex-wrap" role="radiogroup" aria-label="Plataforma de destino">
            {opciones.map((nombre) => (
              <button
                key={nombre}
                role="radio"
                aria-checked={plataforma === nombre}
                onClick={() => setPlataforma(nombre)}
                className={`px-3.5 py-1.5 rounded-full border text-[0.8rem] font-semibold transition-colors ${
                  plataforma === nombre
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {nombre}
              </button>
            ))}
          </div>

          <div className="text-[0.72rem] font-bold uppercase tracking-wider text-slate-500 mt-4 mb-2">2 · Qué exportar</div>
          <div className="flex flex-col gap-2.5">
            {SECCIONES.map((s) => {
              const cuenta = preview?.secciones.find((x) => x.clave === s.clave)?.archivos;
              return (
                <div key={s.clave} className={marcadas[s.clave] ? "" : "opacity-55"}>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 m-0 font-bold text-slate-800 text-[0.85rem] min-w-[150px] cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-auto"
                        checked={marcadas[s.clave]}
                        onChange={(e) => setMarcadas((p) => ({ ...p, [s.clave]: e.target.checked }))}
                      />
                      {s.icono} {s.titulo}
                    </label>
                    <select
                      aria-label={`Estructura de ${s.titulo}`}
                      value={estructuras[s.clave]}
                      disabled={!marcadas[s.clave]}
                      onChange={(e) => setEstructuras((p) => ({
                        ...p, [s.clave]: e.target.value as EstructuraExport,
                      }))}
                      className="flex-1 h-9 px-2 border border-slate-300 rounded-lg text-[0.78rem] bg-white outline-none"
                    >
                      {ESTRUCTURAS.map((o) => (
                        <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-[0.72rem] text-slate-500 mt-0.5 ml-6">
                    {marcadas[s.clave]
                      ? `${s.ayuda}${cuenta === undefined ? "" : ` · ${cuenta} archivo${cuenta === 1 ? "" : "s"}`}`
                      : "No se incluye"}
                  </div>
                </div>
              );
            })}
            <label className="flex items-center gap-2 m-0 mt-1 font-semibold text-slate-700 text-[0.82rem] cursor-pointer">
              <input
                type="checkbox"
                className="w-auto"
                checked={soloVigentes}
                onChange={(e) => setSoloVigentes(e.target.checked)}
              />
              Solo documentos vigentes
            </label>
            <div className="text-[0.72rem] text-slate-500 -mt-1.5 ml-6">
              {soloVigentes
                ? "Los vencidos quedan fuera del ZIP."
                : "Se incluyen también los documentos vencidos."}
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[0.72rem] font-bold uppercase tracking-wider text-slate-500">Vista previa del archivo</div>
            {cargando && <span className="text-[0.7rem] text-slate-400">Calculando…</span>}
          </div>
          <div className="rounded-xl bg-slate-900 text-slate-200 font-mono text-[0.72rem] leading-relaxed p-3.5 h-[290px] overflow-auto" aria-live="polite">
            {!incluidas.length && <div className="text-slate-400">Selecciona al menos una sección.</div>}
            {incluidas.length > 0 && (
              <div className="font-bold text-white mb-1">🗜️ {preview?.nombre_zip ?? `${plataforma}.zip`}</div>
            )}
            {incluidas.length > 0 && !cargando && preview?.total_archivos === 0 && (
              <div className="text-amber-300">No hay documentos con archivos para esta selección.</div>
            )}
            {lineas.map((l, i) => (
              <div
                key={`${l.nivel}-${l.texto}-${i}`}
                className={`truncate ${l.carpeta ? "text-sky-300" : "text-slate-300"}`}
                style={{ paddingLeft: `${l.nivel * 14}px` }}
                title={l.texto}
              >
                {l.carpeta ? "📁" : "📄"} {l.texto}
              </div>
            ))}
            {preview?.truncado && (
              <div className="text-slate-400 mt-1">… y más archivos (la vista previa se corta a 300)</div>
            )}
          </div>

          <div className="flex gap-2.5 mt-2.5 flex-wrap">
            <div className="flex-1 min-w-[90px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-center">
              <b className="block text-[1.15rem] text-slate-800 leading-tight">{preview?.total_archivos ?? 0}</b>
              <span className="text-[0.68rem] text-slate-500">archivos</span>
            </div>
            <div className="flex-1 min-w-[90px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-center">
              <b className="block text-[1.15rem] text-slate-800 leading-tight">{preview?.total_carpetas ?? 0}</b>
              <span className="text-[0.68rem] text-slate-500">carpetas</span>
            </div>
            <div className="flex-1 min-w-[90px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-center">
              <b className="block text-[1.15rem] text-slate-800 leading-tight">
                {(preview?.excluidos.vencidos ?? 0) + (preview?.excluidos.sin_archivo ?? 0)}
              </b>
              <span className="text-[0.68rem] text-slate-500">excluidos</span>
            </div>
          </div>
          {preview && (
            <div className="text-[0.7rem] text-slate-500 mt-1.5">
              Fuera: {preview.excluidos.vencidos} vencido{preview.excluidos.vencidos === 1 ? "" : "s"} y{" "}
              {preview.excluidos.sin_archivo} sin archivo.
            </div>
          )}

          {descargado && (
            <div className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[0.82rem] text-emerald-800 flex items-center gap-2 flex-wrap">
              <span aria-hidden="true">✓</span> Descargado <b>{descargado}</b>
              {contrato && pid && (
                <button
                  className="ml-auto px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[0.78rem] font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  onClick={marcarSubido}
                  disabled={marcando}
                >
                  {marcando ? "Marcando…" : `Marcar como subido a ${plataforma}`}
                </button>
              )}
            </div>
          )}

          {error && (
            <div role="alert" className="mt-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[0.82rem] text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4 pt-3.5 border-t border-slate-200">
        <button
          className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          onClick={cerrar}
        >
          {descargado ? "Cerrar" : "Cancelar"}
        </button>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
          onClick={descargar}
          disabled={descargando || !preview?.total_archivos}
        >
          {descargando ? "Generando ZIP…" : `↓ Descargar ${preview?.total_archivos ?? 0} archivo${(preview?.total_archivos ?? 0) === 1 ? "" : "s"}`}
        </button>
      </div>
    </Modal>
  );
}
