"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import * as Api from "@/lib/cliente";
import type {
  ActividadFila, Alerta, Contrato, Documento, Matriz, Pagina, Revision, Sujeto, PlataformaContrato
} from "@/lib/tipos";
import { Chip, Modal, Paginador, SEVERIDAD_LABEL, Spinner } from "@/components/ui";
import { AgregarPlataformaModal, GestionarUsuariosModal } from "@/components/PlataformaModals";
import { TabRequisitosContrato } from "@/components/contratos/TabRequisitosContrato";
import { TabPersonalContrato } from "@/components/contratos/TabPersonalContrato";
import { TabEquiposContrato } from "@/components/contratos/TabEquiposContrato";
import { TabDocumentosContrato } from "@/components/contratos/TabDocumentosContrato";
import { TabDocumentosFaena } from "@/components/contratos/TabDocumentosFaena";
import { TabCarpetaArranque } from "@/components/contratos/TabCarpetaArranque";
import { TabEmpresaContrato } from "@/components/contratos/TabEmpresaContrato";
import { TabLicenciaInternaContrato } from "@/components/contratos/TabLicenciaInternaContrato";
import { ContratoLayout } from "@/components/contratos/ContratoLayout";
import { TabResumen } from "@/components/contratos/TabResumen";
import { TabChatContrato } from "@/components/contratos/TabChatContrato";

import { Tab, TABS } from "@/components/contratos/ContratoTabs";


export default function ContratoDetalle() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Contrato | null>(null);
  const [tab, setTab] = useState<Tab>("Alertas");
  const [page, setPage] = useState(1);
  const [docs, setDocs] = useState<Pagina<Documento> | null>(null);
  const [plataformas, setPlataformas] = useState<PlataformaContrato[]>([]);
  const [alertas, setAlertas] = useState<Pagina<Alerta> | null>(null);
  const [hist, setHist] = useState<Pagina<ActividadFila> | null>(null);
  const [matriz, setMatriz] = useState<Matriz | null>(null);
  const [tipoMatriz, setTipoMatriz] = useState<"personal" | "equipo">("personal");
  const [review, setReview] = useState<Revision | null>(null);
  const [subiendo, setSubiendo] = useState<{ docId: string; pct: number; texto: string } | null>(null);
  const [analizandoId, setAnalizandoId] = useState<string | null>(null);

  const [showAddPlataforma, setShowAddPlataforma] = useState(false);
  const [plataformaToManage, setPlataformaToManage] = useState<PlataformaContrato | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(() => {
    Api.contratos.detalle(id).then(setC).catch((e) => setError(Api.mensajeError(e)));
  }, [id]);
  useEffect(cargar, [cargar]);

  const cargarDocs = useCallback(() => {
    Api.contratos.documentos(id, { page, page_size: 50 })
      .then(setDocs).catch((e) => setError(Api.mensajeError(e)));
  }, [id, page]);

  const [tipoHist, setTipoHist] = useState("");
  const [moduloHist, setModuloHist] = useState("");
  const [qHist, setQHist] = useState("");

  // Cada pestaña consume su propio endpoint del contrato (§4): ya no hace falta
  // pedir /alertas o /dashboard/actividad y filtrar en el navegador.
  useEffect(() => {
    setError("");
    const fallo = (e: unknown) => setError(Api.mensajeError(e));
    Api.plataformas.listar(id).then(res => setPlataformas(res.items || [])).catch(fallo);
    if (tab === "Documentos") cargarDocs();
    if (tab === "Alertas") Api.contratos.alertas(id, { page, page_size: 50 }).then(setAlertas).catch(fallo);
    if (tab === "Historial") {
      Api.contratos.historial(id, {
        page, page_size: 20,
        ...(tipoHist ? { tipo: tipoHist } : {}),
        ...(moduloHist ? { modulo: moduloHist } : {}),
      }).then(setHist).catch(fallo);
    }
  }, [tab, id, page, tipoMatriz, tipoHist, moduloHist, cargarDocs]);

  const cambiarTab = (t: Tab) => { setTab(t); setPage(1); };

  /** Subida por SAS + espera del veredicto de la IA (el doc queda `falta`). */
  const subir = async (docId: string, file: File) => {
    setError(""); setAviso("");
    setSubiendo({ docId, pct: 0, texto: "Preparando la subida…" });
    let jobId = "";
    try {
      const res = await Api.subirDocumento(docId, file, (pct, etapa) => {
        const texto = etapa === "subiendo" ? "Subiendo el archivo…"
          : etapa === "confirmando" ? "Registrando el archivo…"
          : etapa === "firmando" ? "Preparando la subida…" : "Listo";
        setSubiendo({ docId, pct, texto });
      });
      jobId = res.job_id;
      cargarDocs();
    } catch (e) {
      setError(Api.mensajeError(e));
      return;
    } finally { setSubiendo(null); }

    setAnalizandoId(docId);
    try {
      const result = await Api.esperarRevision(jobId);
      setReview(result);
      cargarDocs();
      cargar();
      
      if (result.resultado === "con_errores") {
        toast.error("El documento fue rechazado", {
          description: result.hallazgos?.[0]?.mensaje || "El archivo contiene errores y ha sido descartado.",
          duration: 8000,
        });
      } else if (result.resultado === "con_observaciones") {
        toast.warning("El documento tiene observaciones", {
          description: result.hallazgos?.[0]?.mensaje || "Se han detectado advertencias menores.",
          duration: 6000,
        });
      } else if (result.resultado === "validado") {
        toast.success("Documento aprobado", {
          description: "La IA ha verificado el documento exitosamente.",
        });
      }

    } catch (e) {
      if (Api.esApiError(e) && e.code === "REVISION_TIMEOUT") setAviso(e.message);
      else setError(Api.mensajeError(e));
    } finally { setAnalizandoId(null); }
  };

  const descargar = async (docId: string, archivoId: string) => {
    setError("");
    try { await Api.descargarArchivo(docId, archivoId); }
    catch (e) { setError(Api.mensajeError(e)); }
  };

  const handleDeletePlataforma = async (pid: string) => {
    if (!confirm('¿Estás seguro de que deseas desvincular esta plataforma de este contrato?')) return;
    try {
      await Api.plataformas.eliminar(id as string, pid);
      setPlataformas(prev => prev.filter(p => p.id !== pid));
    } catch (e: any) {
      alert('Error al eliminar plataforma: ' + e.message);
    }
  };

  if (!c) return error ? <p className="p-6 text-red-600">{error}</p> : <Spinner />;

  const pct = c.stats?.cumplimiento_pct || 0;
  const vigente = pct >= 70;

  return (
    <ContratoLayout
      contrato={c}
      plataformas={plataformas}
      vigente={vigente}
      onDeletePlataforma={handleDeletePlataforma}
      onAddPlataforma={() => setShowAddPlataforma(true)}
      onManagePlataforma={setPlataformaToManage}
      onRefreshPlataformas={() => Api.plataformas.listar(id).then(res => setPlataformas(res.items || []))}
      tabActual={tab}
      onTabChange={cambiarTab}
    >
      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 mb-4">{error}</p>}
      {aviso && <p className="rounded-lg bg-sky-50 px-4 py-2 text-sm text-sky-800 mb-4">ℹ️ {aviso}</p>}

      {tab === "Resumen" && (
        <TabResumen contrato={c} cambiarTab={cambiarTab} plataformas={plataformas} />
      )}

      {tab === "Documentos" && c && (
        <TabDocumentosContrato contrato={c} />
      )}

      {tab === "Empresa" && c && (
        <TabEmpresaContrato contrato={c} onSubir={subir} subiendo={subiendo} analizandoId={analizandoId} />
      )}

      {tab === "Personal" && c && (
        <TabPersonalContrato contrato={c} plataformas={plataformas} />
      )}
      {tab === "Vehículos / Equipos" && c && (
        <TabEquiposContrato contrato={c} plataformas={plataformas} />
      )}

      {tab === "Alertas" && (
        <section className="space-y-2">
          {Api.items(alertas).length === 0 && <p className="text-sm text-slate-500">Sin alertas para este contrato.</p>}
          {Api.items(alertas).map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <Chip estado={a.severidad} texto={SEVERIDAD_LABEL[a.severidad]} />
              <div className="text-sm"><b>{a.titulo}</b><div className="text-slate-500">{a.descripcion}</div></div>
              <Chip estado={a.estado} />
            </div>
          ))}
          {alertas && <Paginador page={alertas.page} totalPaginas={alertas.total_pages} total={alertas.total} etiqueta="alertas" onPagina={setPage} />}
        </section>
      )}
      {tab === "Requisitos" && c && (
        <TabRequisitosContrato contrato={c} plataformas={plataformas} onCambio={cargar} />
      )}

      {tab === "Licencia Interna" && c && (
        <TabLicenciaInternaContrato contrato={c} cambiarTab={cambiarTab} onSubir={subir} subiendo={subiendo} analizandoId={analizandoId} />
      )}

      {tab === "Chat" && c && (
        <TabChatContrato contrato={c} />
      )}

      {tab === "Historial" && (
        <div>
          <div className="mb-3.5">
            <h3 className="text-[#1E293B] text-[0.95rem] font-bold m-0">Historial del contrato</h3>
            <p className="text-[0.78rem] text-slate-500 mt-0.5 mb-0">Registro de todas las actividades y cambios realizados en este contrato.</p>
          </div>
          <div className="view-filters">
            <input
              className="view-search"
              placeholder="Buscar por actividad, usuario o detalle..."
              value={qHist}
              onChange={(e) => setQHist(e.target.value)}
            />
            <select
              className="view-select"
              aria-label="Tipo de actividad"
              value={tipoHist}
              onChange={(e) => { setTipoHist(e.target.value); setPage(1); }}
            >
              <option value="">Tipo de actividad: Todas</option>
              <option value="creacion">Creación</option>
              <option value="actualizacion">Actualización</option>
              <option value="subida_documento">Subida de documento</option>
              <option value="asignacion">Asignación</option>
              <option value="alerta_ia">Alerta IA</option>
              <option value="visualizacion">Visualización</option>
              <option value="comentario">Comentario</option>
            </select>
            <select
              className="view-select"
              aria-label="Módulo"
              value={moduloHist}
              onChange={(e) => { setModuloHist(e.target.value); setPage(1); }}
            >
              <option value="">Módulo: Todos</option>
              <option value="contrato">Contrato</option>
              <option value="documentos">Documentos</option>
              <option value="personal">Personal</option>
              <option value="equipos">Equipos</option>
              <option value="alertas">Alertas</option>
              <option value="requisitos">Requisitos</option>
              <option value="reportes">Reportes</option>
            </select>
          </div>
          <TablaHistorial
            filas={Api.items(hist).filter((h) => {
              if (!qHist.trim()) return true;
              const q = qHist.toLowerCase();
              return `${h.descripcion} ${h.usuario?.nombre || ""} ${h.modulo}`.toLowerCase().includes(q);
            })}
            cargando={!hist}
          />
          {hist && <Paginador page={hist.page} totalPaginas={hist.total_pages} total={hist.total} etiqueta="movimientos" onPagina={setPage} />}
        </div>
      )}

      {tab === "Documentos Faena" && c && (
        <TabDocumentosFaena
          contrato={c}
          onVerEquipo={() => cambiarTab("Vehículos / Equipos")}
        />
      )}

      {tab === "Carpeta de Arranque" && c && (
        <TabCarpetaArranque
          contrato={c}
          onSubir={subir}
          subiendo={subiendo}
          analizandoId={analizandoId}
        />
      )}

      <Modal abierto={!!review} titulo="Revisión IA" onCerrar={() => setReview(null)} ancho="max-w-xl">
        {review && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Chip estado={review.status === "failed" ? "failed"
                : review.resultado === "validado" ? "ok"
                : review.resultado === "con_errores" ? "venc" : "porvenc"}
                texto={review.resultado ?? review.status} />
              {review.confianza != null && (
                <span className="text-sm text-slate-500">Confianza: {(review.confianza * 100).toFixed(0)}%</span>
              )}
            </div>
            {review.accion_aplicada && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Acción aplicada: {review.accion_aplicada}
              </p>
            )}
            {review.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 border border-red-200 font-medium">
                Detalle del error: {review.error}
              </p>
            )}
            <ul className="space-y-2 text-sm">
              {review.hallazgos.map((h, i) => (
                <li key={i} className="rounded-lg bg-slate-50 px-3 py-2">
                  {h.tipo === "error" ? "⛔" : h.tipo === "warning" ? "⚠️" : "✅"} {h.mensaje}
                </li>
              ))}
            </ul>
            <button className="btn-primary w-full" onClick={() => setReview(null)}>Entendido</button>
          </div>
        )}
      </Modal>

      <AgregarPlataformaModal
        abierto={showAddPlataforma}
        onCerrar={() => setShowAddPlataforma(false)}
        contratoId={id}
        onAgregada={() => Api.plataformas.listar(id).then(res => setPlataformas(res.items || []))}
      />
      
      <GestionarUsuariosModal
        plataforma={plataformaToManage}
        contratoId={id}
        onCerrar={() => {
          setPlataformaToManage(null);
          Api.plataformas.listar(id).then(res => setPlataformas(res.items || []));
        }}
      />
    </ContratoLayout>
  );
}

/**
 * Historial del contrato estilo referencia: tabla con tipo, módulo,
 * descripción, usuario y plataforma.
 */
const TIPO_HIST: Record<string, { lbl: string; fondo: string; color: string }> = {
  creacion: { lbl: "Creación", fondo: "#dcfce7", color: "#166534" },
  actualizacion: { lbl: "Actualización", fondo: "#dbeafe", color: "#1e40af" },
  subida_documento: { lbl: "Subida de documento", fondo: "#f3e8ff", color: "#6b21a8" },
  asignacion: { lbl: "Asignación", fondo: "#fef9c3", color: "#854d0e" },
  alerta_ia: { lbl: "Alerta IA", fondo: "#fee2e2", color: "#b91c1c" },
  visualizacion: { lbl: "Visualización", fondo: "#f0fdf4", color: "#166534" },
  comentario: { lbl: "Comentario", fondo: "#fff7ed", color: "#9a3412" },
};

function TablaHistorial({ filas, cargando }: { filas: ActividadFila[]; cargando: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-[12px] shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left text-[0.68rem] text-slate-500 font-bold uppercase tracking-wider">
              <th className="py-3 px-4">Fecha y hora</th>
              <th className="py-3 px-4">Tipo de actividad</th>
              <th className="py-3 px-4">Módulo</th>
              <th className="py-3 px-4">Descripción</th>
              <th className="py-3 px-4">Usuario</th>
              <th className="py-3 px-4">Plataforma</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-[0.85rem]">Cargando historial...</td></tr>
            ) : filas.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-[0.85rem]">Sin actividad registrada para estos filtros.</td></tr>
            ) : (
              filas.map((h) => {
                const t = TIPO_HIST[h.tipo] || { lbl: h.tipo, fondo: "#f1f5f9", color: "#475569" };
                return (
                  <tr key={h.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-[0.78rem] text-slate-500 whitespace-nowrap">
                      {new Date(h.created_at).toLocaleString("es-CL")}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block text-[0.68rem] font-bold px-2 py-0.5 rounded-lg whitespace-nowrap" style={{ backgroundColor: t.fondo, color: t.color }}>
                        {t.lbl}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[0.8rem] text-slate-500 capitalize">{h.modulo}</td>
                    <td className="py-3 px-4 text-[0.8rem] text-slate-800">{h.descripcion}</td>
                    <td className="py-3 px-4 text-[0.78rem] text-slate-700">{h.usuario?.nombre || "—"}</td>
                    <td className="py-3 px-4 text-[0.78rem] text-slate-500">{h.plataforma || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Matriz de cumplimiento sujeto × requisito.
 * sujeto, indexadas por `col`. El hueco se pinta «—», que no es lo mismo que
 * `falta`. Las columnas son las de los sujetos de la página, así que pueden
 * cambiar al paginar.
 */
function TablaMatriz({ matriz, onPagina }: { matriz: Matriz; onPagina: (p: number) => void }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="tabla">
          <thead>
            <tr>
              <th className="sticky left-0 bg-slate-50">Sujeto</th>
              <th>%</th>
              {matriz.columnas.map((col, i) => (
                <th key={i} className="whitespace-nowrap text-xs">
                  {col.titulo}{col.obligatorio ? "" : " (opc.)"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matriz.filas.map((f) => {
              const porCol = new Map(f.celdas.map((c) => [c.col, c]));
              return (
                <tr key={f.sujeto_id}>
                  <td className="sticky left-0 bg-white">
                    <div className="font-medium">{f.nombre}</div>
                    <div className="text-xs text-slate-500">{f.rut ?? ""} {f.cargo ?? ""}</div>
                  </td>
                  <td className="font-bold">{f.cumplimiento_pct}%</td>
                  {matriz.columnas.map((_, i) => {
                    const celda = porCol.get(i);
                    if (!celda) return <td key={i} className="text-center text-slate-300">—</td>;
                    return (
                      <td key={i} className="text-center">
                        <Chip estado={celda.estado_calc} texto={celda.vence ?? undefined} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {matriz.filas.length === 0 && <p className="p-4 text-sm text-slate-500">Sin sujetos para esta matriz.</p>}
      </div>
      <Paginador page={matriz.page} totalPaginas={matriz.total_pages} total={matriz.total_filas}
        etiqueta="filas" onPagina={onPagina} />
    </div>
  );
}
