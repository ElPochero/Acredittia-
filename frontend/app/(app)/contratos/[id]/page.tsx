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
import { ContratoLayout } from "@/components/contratos/ContratoLayout";
import { TabResumen } from "@/components/contratos/TabResumen";

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

  // Cada pestaña consume su propio endpoint del contrato (§4): ya no hace falta
  // pedir /alertas o /dashboard/actividad y filtrar en el navegador.
  useEffect(() => {
    setError("");
    const fallo = (e: unknown) => setError(Api.mensajeError(e));
    Api.plataformas.listar(id).then(res => setPlataformas(res.items || [])).catch(fallo);
    if (tab === "Documentos") cargarDocs();
    if (tab === "Alertas") Api.contratos.alertas(id, { page, page_size: 50 }).then(setAlertas).catch(fallo);
  }, [tab, id, page, tipoMatriz, cargarDocs]);

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
      tabActual={tab}
      onTabChange={cambiarTab}
    >
      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 mb-4">{error}</p>}
      {aviso && <p className="rounded-lg bg-sky-50 px-4 py-2 text-sm text-sky-800 mb-4">ℹ️ {aviso}</p>}

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

      {tab === "Documentos" && c && (
        <TabDocumentosContrato contrato={c} />
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

      {tab === "Personal" && c && (
        <TabPersonalContrato contrato={c} plataformas={plataformas} />
      )}

      {tab === "Empresa" && c && (
        <TabEmpresaContrato contrato={c} onSubir={subir} subiendo={subiendo} analizandoId={analizandoId} />
      )}

      {tab === "Vehículos / Equipos" && c && (
        <TabEquiposContrato contrato={c} plataformas={plataformas} />
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
