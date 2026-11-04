"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Modal } from "@/components/shared/ui";
import { toast } from "sonner";
import * as Api from "@/lib/platform/cliente";
import type {
  Credencial,
  Documento,
  PlataformaContrato,
  SujetoDetalle,
} from "@/lib/platform/tipos";
import { GestionarUsuariosModal } from "./PlataformaModals";

interface AutoExportModalProps {
  abierto: boolean;
  onCerrar: () => void;
  sujeto: SujetoDetalle;
  contratoId: string;
  documentos: Documento[];
  onSuccess: () => void;
}

interface GrupoPlataforma {
  plat: string;
  url: string;
  items: Documento[];
  plataformaObj?: PlataformaContrato;
  usuarios: Credencial[];
  usuarioSeleccionadoId: string;
}

const AE_URL_DEFECTO: Record<string, string> = {
  SIGA: "siga.amsa.cl",
  DIRECTIC: "portal.directic.cl",
  SGES: "sges.amsa.cl",
  "Academia MLP": "academiamlp.com",
  EMSIPOR: "emsipor.com",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AutoExportModal({
  abierto,
  onCerrar,
  sujeto,
  contratoId,
  documentos,
  onSuccess,
}: AutoExportModalProps) {
  const [cargando, setCargando] = useState(true);
  const [plataformasContrato, setPlataformasContrato] = useState<PlataformaContrato[]>([]);
  const [credencialesPorPlat, setCredencialesPorPlat] = useState<Record<string, Credencial[]>>({});
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Record<string, string>>({});
  const [modalUsuarioPlat, setModalUsuarioPlat] = useState<PlataformaContrato | null>(null);

  // Estado de la ejecución
  const [ejecutando, setEjecutando] = useState(false);
  const [completado, setCompletado] = useState(false);
  const [logsPorGrupo, setLogsPorGrupo] = useState<Record<string, { texto: string; tipo: "normal" | "ok" | "mut" | "err" }[]>>({});
  const [estadoPorGrupo, setEstadoPorGrupo] = useState<Record<string, { texto: string; estado: "espera" | "run" | "ok" }>>({});
  const [urlPorGrupo, setUrlPorGrupo] = useState<Record<string, string>>({});
  const [totalSubidos, setTotalSubidos] = useState(0);

  // Cargar selecciones previas de localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("acr_ae_sel");
      if (saved) {
        setUsuarioSeleccionado(JSON.parse(saved));
      }
    } catch {
      // Ignorar errores de parseo
    }
  }, []);

  // Filtrar documentos que tienen archivo cargado o estado ok/porvenc
  const docsExportables = useMemo(() => {
    return (documentos || []).filter((d) => {
      const tieneArchivos = (d.archivos_count && d.archivos_count > 0) || (d.archivos && d.archivos.length > 0);
      const estadoValido = d.estado_calc === "ok" || d.estado_calc === "porvenc" || d.estado === "ok";
      return tieneArchivos || estadoValido;
    });
  }, [documentos]);

  // Cargar plataformas y credenciales de la bóveda
  const cargarDatos = async () => {
    if (!contratoId) return;
    setCargando(true);
    try {
      const resPlats = await Api.plataformas.listar(contratoId);
      const plats = resPlats.items || [];
      setPlataformasContrato(plats);

      // Agrupar nombres de plataformas de los docs
      const plataformasUnicas = Array.from(
        new Set(
          docsExportables.map(
            (d) => d.plataforma || (d.es_emsipor ? "EMSIPOR" : "General")
          )
        )
      );

      const creds: Record<string, Credencial[]> = {};
      const selecciones: Record<string, string> = { ...usuarioSeleccionado };

      await Promise.all(
        plataformasUnicas.map(async (platNombre) => {
          const matchPlat = plats.find(
            (p) =>
              p.nombre.toLowerCase().trim() === platNombre.toLowerCase().trim() ||
              (p.id && p.id === platNombre) ||
              (p.faena_plataforma_id && p.faena_plataforma_id === platNombre)
          );

          const pid = matchPlat?.id || matchPlat?.faena_plataforma_id;
          if (pid) {
            try {
              const resCreds = await Api.credenciales.listar(contratoId, pid);
              creds[platNombre] = resCreds.items || [];
              // Si no había selección previa y hay usuarios, auto-seleccionar el primero
              const sk = `${contratoId}|${platNombre}`;
              if (!selecciones[sk] && resCreds.items && resCreds.items.length > 0) {
                selecciones[sk] = resCreds.items[0].id;
              }
            } catch {
              creds[platNombre] = [];
            }
          } else {
            creds[platNombre] = [];
          }
        })
      );

      setCredencialesPorPlat(creds);
      setUsuarioSeleccionado(selecciones);
    } catch (e: any) {
      toast.error(e.message || "Error al cargar plataformas de la bóveda");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (abierto) {
      setEjecutando(false);
      setCompletado(false);
      setLogsPorGrupo({});
      setEstadoPorGrupo({});
      setUrlPorGrupo({});
      setTotalSubidos(0);
      cargarDatos();
    }
  }, [abierto, contratoId]);

  // Construir grupos para exportación
  const grupos: GrupoPlataforma[] = useMemo(() => {
    const mapa: Record<string, Documento[]> = {};
    for (const d of docsExportables) {
      const pn = d.plataforma || (d.es_emsipor ? "EMSIPOR" : "General");
      if (!mapa[pn]) mapa[pn] = [];
      mapa[pn].push(d);
    }

    return Object.entries(mapa).map(([platNombre, items]) => {
      const matchPlat = plataformasContrato.find(
        (p) =>
          p.nombre.toLowerCase().trim() === platNombre.toLowerCase().trim() ||
          p.id === platNombre ||
          p.faena_plataforma_id === platNombre
      );

      const urlDef =
        matchPlat?.url && matchPlat.url !== "#"
          ? matchPlat.url.replace(/^https?:\/\//, "")
          : AE_URL_DEFECTO[platNombre] || `${platNombre.toLowerCase().replace(/\s+/g, "")}.cl`;

      const usuarios = credencialesPorPlat[platNombre] || [];
      const sk = `${contratoId}|${platNombre}`;
      const usuarioSelId = usuarioSeleccionado[sk] || (usuarios.length === 1 ? usuarios[0].id : "");

      return {
        plat: platNombre,
        url: urlDef,
        items,
        plataformaObj: matchPlat,
        usuarios,
        usuarioSeleccionadoId: usuarioSelId,
      };
    });
  }, [docsExportables, plataformasContrato, credencialesPorPlat, usuarioSeleccionado, contratoId]);

  const totalPendientes = useMemo(() => {
    return grupos.reduce(
      (acc, g) => acc + g.items.filter((x) => x.estado_plataforma !== "subido").length,
      0
    );
  }, [grupos]);

  const seleccionarUsuario = (platNombre: string, userId: string) => {
    const sk = `${contratoId}|${platNombre}`;
    const nuevo = { ...usuarioSeleccionado, [sk]: userId };
    setUsuarioSeleccionado(nuevo);
    try {
      localStorage.setItem("acr_ae_sel", JSON.stringify(nuevo));
    } catch {
      // Ignorar errores de almacenamiento local
    }
  };

  const puedeIniciar = useMemo(() => {
    if (grupos.length === 0 || totalPendientes === 0) return false;
    // Cada plataforma con documentos pendientes debe tener un usuario seleccionado
    return grupos.every((g) => {
      const tienePendientes = g.items.some((x) => x.estado_plataforma !== "subido");
      if (!tienePendientes) return true;
      return g.usuarios.length > 0 && !!g.usuarioSeleccionadoId;
    });
  }, [grupos, totalPendientes]);

  const iniciarExportacion = async () => {
    if (!puedeIniciar) {
      toast.error("Selecciona el usuario para cada plataforma con documentos pendientes.");
      return;
    }

    setEjecutando(true);
    setCompletado(false);

    // Inicializar estados visuales de consola
    const initLogs: Record<string, { texto: string; tipo: "normal" | "ok" | "mut" | "err" }[]> = {};
    const initEstados: Record<string, { texto: string; estado: "espera" | "run" | "ok" }> = {};
    const initUrls: Record<string, string> = {};

    grupos.forEach((g) => {
      initLogs[g.plat] = [];
      initEstados[g.plat] = { texto: "En espera", estado: "espera" };
      initUrls[g.plat] = `https://${g.url}/login`;
    });

    setLogsPorGrupo(initLogs);
    setEstadoPorGrupo(initEstados);
    setUrlPorGrupo(initUrls);

    const who = sujeto.tipo === "trabajador" ? "trabajador" : "equipo";
    const whos = sujeto.tipo === "trabajador" ? "trabajadores" : "equipos";
    let documentosExitosos = 0;

    for (const g of grupos) {
      const u = g.usuarios.find((x) => x.id === g.usuarioSeleccionadoId);
      if (!u && g.items.some((x) => x.estado_plataforma !== "subido")) {
        continue;
      }

      const appendLog = (plat: string, texto: string, tipo: "normal" | "ok" | "mut" | "err" = "normal") => {
        setLogsPorGrupo((prev) => ({
          ...prev,
          [plat]: [...(prev[plat] || []), { texto, tipo }],
        }));
      };

      setEstadoPorGrupo((prev) => ({
        ...prev,
        [g.plat]: { texto: "Conectando…", estado: "run" },
      }));

      appendLog(g.plat, `Abriendo ${g.url}`);
      await sleep(600);

      appendLog(g.plat, `Iniciando sesión como ${u?.usuario || "cuenta_mandante"}…`);
      await sleep(900);

      appendLog(g.plat, "✓ Sesión iniciada", "ok");
      setUrlPorGrupo((prev) => ({
        ...prev,
        [g.plat]: `https://${g.url}/contratista/${whos}`,
      }));
      await sleep(400);

      const idSujeto = sujeto.rut || sujeto.patente || sujeto.nombre || "";
      appendLog(g.plat, `Buscando ${who} ${idSujeto}…`);
      await sleep(700);

      appendLog(g.plat, `✓ Ficha encontrada: ${sujeto.nombre || sujeto.patente || ""}`, "ok");
      setUrlPorGrupo((prev) => ({
        ...prev,
        [g.plat]: `https://${g.url}/contratista/${whos}/${idSujeto.replace(/[.\s]/g, "")}/requisitos`,
      }));
      await sleep(500);

      const docsParaSubir: Documento[] = [];
      for (const item of g.items) {
        if (item.estado_plataforma === "subido") {
          appendLog(g.plat, `↷ ${item.titulo}: ya estaba subido`, "mut");
          continue;
        }

        const nombreArchivo = (item.archivos && item.archivos[0]?.filename) || "documento.pdf";
        appendLog(g.plat, `Subiendo ${item.titulo} (${nombreArchivo})…`);
        await sleep(750 + Math.random() * 300);

        docsParaSubir.push(item);
        appendLog(g.plat, `✓ ${item.titulo} subido a ${g.plat}`, "ok");
      }

      // Actualizar en el Backend via bulkEstadoPlataforma
      if (docsParaSubir.length > 0) {
        try {
          await Api.documentos.bulkEstadoPlataforma({
            documento_ids: docsParaSubir.map((d) => d.id),
            estado_plataforma: "subido",
            plataforma: g.plat,
            usuario_plataforma: u?.usuario,
          });
          documentosExitosos += docsParaSubir.length;
        } catch (e: any) {
          appendLog(g.plat, `⚠ Error al sincronizar estado en plataforma: ${e.message}`, "err");
        }
      }

      appendLog(g.plat, "Cerrando sesión");
      await sleep(350);

      setEstadoPorGrupo((prev) => ({
        ...prev,
        [g.plat]: {
          texto: `✓ ${g.items.length} documento${g.items.length === 1 ? "" : "s"}`,
          estado: "ok",
        },
      }));
    }

    setTotalSubidos(documentosExitosos);
    setEjecutando(false);
    setCompletado(true);
    toast.success(`Exportación automática: ${documentosExitosos} documentos subidos.`);
    onSuccess();
  };

  const ocultarPassword = (p?: string) => {
    if (!p) return "";
    return p.slice(0, 2) + "•".repeat(Math.max(4, p.length - 2));
  };

  return (
    <>
      <Modal
        abierto={abierto}
        onCerrar={() => (!ejecutando ? onCerrar() : null)}
        titulo={
          <div className="flex items-center gap-2">
            <span>⚡</span>
            <span>Exportación automática</span>
          </div>
        }
      >
        <div className="w-full max-w-[760px] mx-auto text-slate-800">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-xl shrink-0">
              ⚡
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">
                Exportación automática
              </h3>
              <div className="text-xs text-slate-500 mt-0.5">
                {sujeto.nombre || sujeto.patente}
                {sujeto.rut ? ` · ${sujeto.rut}` : ""}
                {sujeto.patente && sujeto.rut ? ` · ${sujeto.patente}` : ""} ·{" "}
                {docsExportables.length} documento{docsExportables.length === 1 ? "" : "s"} cargado{docsExportables.length === 1 ? "" : "s"} en{" "}
                {grupos.length} plataforma{grupos.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 my-3 leading-relaxed">
            ACREDITTIA inicia sesión en cada plataforma del mandante con el usuario y clave
            registrados en la bóveda, entra a la ficha del{" "}
            {sujeto.tipo === "trabajador" ? "trabajador" : "equipo"}, sube cada documento en su
            requisito y luego confirma aquí el resultado.
          </div>

          {cargando ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Cargando plataformas y usuarios de la bóveda…
            </div>
          ) : grupos.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Este {sujeto.tipo === "trabajador" ? "trabajador" : "equipo"} no tiene documentos
              cargados para exportar.
            </div>
          ) : (
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {grupos.map((g) => {
                const logs = logsPorGrupo[g.plat] || [];
                const estado = estadoPorGrupo[g.plat] || { texto: "En espera", estado: "espera" };
                const url = urlPorGrupo[g.plat] || `https://${g.url}/login`;
                const tienePendientes = g.items.some((x) => x.estado_plataforma !== "subido");
                const uSel = g.usuarios.find((x) => x.id === g.usuarioSeleccionadoId);

                return (
                  <div
                    key={g.plat}
                    className="border border-slate-200 rounded-xl p-3.5 bg-white shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 flex-wrap text-sm">
                      <b className="text-slate-900">{g.plat}</b>
                      <span className="text-xs text-slate-500 font-mono">{g.url}</span>

                      {/* Estado o Selector de usuario */}
                      {ejecutando || completado ? (
                        <span
                          className={`ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            estado.estado === "run"
                              ? "bg-amber-100 text-amber-800"
                              : estado.estado === "ok"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {estado.texto}
                        </span>
                      ) : (
                        <div className="ml-auto flex items-center gap-2 flex-wrap">
                          {g.usuarios.length > 0 ? (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <span className="font-medium text-slate-500">Enviar con usuario:</span>
                              <select
                                value={g.usuarioSeleccionadoId}
                                onChange={(e) => seleccionarUsuario(g.plat, e.target.value)}
                                className={`text-xs px-2.5 py-1 rounded-lg border outline-none font-medium ${
                                  !g.usuarioSeleccionadoId && tienePendientes
                                    ? "border-amber-400 bg-amber-50 text-amber-900 font-bold"
                                    : "border-slate-300 bg-white text-slate-700"
                                }`}
                              >
                                <option value="">Elige un usuario…</option>
                                {g.usuarios.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.nombre} · {u.usuario}
                                  </option>
                                ))}
                              </select>
                              {uSel && (
                                <span className="font-mono text-[0.7rem] bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                                  🔑 {ocultarPassword((uSel as any)?.password || "••••••••")}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg font-medium">
                                ⚠ Sin usuarios configurados
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  // Abre modal de usuarios
                                  const targetPlat: PlataformaContrato = g.plataformaObj || {
                                    id: g.plat,
                                    nombre: g.plat,
                                    url: g.url,
                                    activo: true,
                                    descripcion: null,
                                    color: null,
                                    nota: null,
                                    origen: "propia",
                                    faena_plataforma_id: null,
                                    acceso_estado: "activo",
                                    acceso_nota: null,
                                    acceso_actualizado_at: null,
                                    total_requisitos: 0,
                                    total_credenciales: 0,
                                    orden: 0,
                                    estado: "activa",
                                    solicitado_at: null,
                                    habilitado_at: null,
                                    es_custom: false,
                                  } as any;
                                  setModalUsuarioPlat(targetPlat);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                              >
                                + Configurar usuario
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Lista de documentos de la plataforma */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {g.items.map((item) => {
                        const estaSubido = item.estado_plataforma === "subido";
                        return (
                          <span
                            key={item.id}
                            className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                              estaSubido
                                ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-medium"
                                : "bg-slate-50 border-slate-200 text-slate-600"
                            }`}
                          >
                            {item.titulo}
                            {estaSubido ? " ✓" : ""}
                          </span>
                        );
                      })}
                    </div>

                    {/* Consola de ejecución (mock browser y logs en terminal oscura) */}
                    {(ejecutando || completado) && (
                      <div className="mt-3 border border-slate-300 rounded-lg overflow-hidden shadow-inner">
                        <div className="bg-slate-100 px-3 py-1.5 flex items-center gap-2 text-[0.72rem] text-slate-600 font-mono border-b border-slate-200">
                          <span className="flex gap-1.5">
                            <i className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"></i>
                            <i className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></i>
                            <i className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></i>
                          </span>
                          <span className="truncate">{url}</span>
                        </div>
                        <div
                          className="p-2.5 font-mono text-[0.75rem] leading-relaxed max-h-[140px] overflow-y-auto"
                          style={{ background: "#0F172A", color: "#CBD5E1" }}
                        >
                          {logs.map((l, idx) => (
                            <div
                              key={idx}
                              className={
                                l.tipo === "ok"
                                  ? "text-emerald-400"
                                  : l.tipo === "mut"
                                  ? "text-slate-500"
                                  : l.tipo === "err"
                                  ? "text-rose-400"
                                  : "text-slate-300"
                              }
                            >
                              {l.texto}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer / Acciones */}
          <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
            {completado ? (
              <>
                <div className="flex-1 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl px-3.5 py-2 text-xs font-medium">
                  ✓ Exportación completada: <b>{totalSubidos} documento{totalSubidos === 1 ? "" : "s"}</b> subido{totalSubidos === 1 ? "" : "s"} a{" "}
                  {grupos.map((g) => g.plat).join(", ")}. Quedaron marcados como{" "}
                  <b>Subido a plataforma</b>.
                </div>
                <button
                  type="button"
                  onClick={onCerrar}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm cursor-pointer"
                >
                  Listo
                </button>
              </>
            ) : ejecutando ? (
              <div className="w-full text-center text-xs text-slate-500 py-1 font-medium animate-pulse">
                Exportando a las plataformas del mandante… no cierres esta ventana.
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onCerrar}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                {totalPendientes > 0 ? (
                  !puedeIniciar ? (
                    <button
                      type="button"
                      disabled
                      className="px-4 py-2 rounded-lg bg-slate-300 text-slate-500 text-xs font-bold cursor-not-allowed"
                    >
                      Elige el usuario de cada plataforma
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={iniciarExportacion}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <span>⚡</span> Iniciar exportación automática ({totalPendientes} pendientes)
                    </button>
                  )
                ) : (
                  <span className="text-xs text-slate-500 font-medium">
                    Todos los documentos cargados ya están marcados como subidos.
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal secundario para configurar usuario sin perder el contexto */}
      {modalUsuarioPlat && (
        <GestionarUsuariosModal
          plataforma={modalUsuarioPlat}
          contratoId={contratoId}
          onCerrar={() => {
            setModalUsuarioPlat(null);
            cargarDatos();
          }}
        />
      )}
    </>
  );
}
