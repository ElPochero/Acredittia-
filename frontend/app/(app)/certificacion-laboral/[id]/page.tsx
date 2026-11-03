"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import * as Api from "@/lib/cliente";
import type {
  Contrato,
  ContratoCertificacionLaboral,
  PeriodoLaboral,
  MatrizCumplimientoData,
  PeriodoDocumento,
  CumplimientoDashboardData,
  AuditoriaDocumento,
  TrazabilidadEvento,
} from "@/lib/tipos";
import PeriodoCard from "@/components/PeriodoCard";
import TabNominaPeriodo from "@/components/certificacion/TabNominaPeriodo";
import MatrizDocumental from "@/components/MatrizDocumental";
import AuditoriaModal from "@/components/AuditoriaModal";
import CumplimientoDashboard from "@/components/CumplimientoDashboard";
import { CompartirContratoModal } from "@/components/contratos/CompartirContratoModal";
import { Chip, Spinner, Donut, Modal } from "@/components/ui";

type TabTipo = "dashboard" | "documentos" | "nomina" | "auditoria" | "trazabilidad";
type FiltroAuditoriaTipo = "por_revisar" | "todos" | "observados_rechazados" | "aprobados";

export default function ContratoCertificacionDetallePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const contratoId = (params?.id as string) || "";

  // Estados principales
  const [cargandoContrato, setCargandoContrato] = useState(true);
  const [contrato, setContrato] = useState<ContratoCertificacionLaboral | null>(null);
  const [contratoRaw, setContratoRaw] = useState<Contrato | null>(null);
  const [periodos, setPeriodos] = useState<PeriodoLaboral[]>([]);
  const [periodoActivo, setPeriodoActivo] = useState<PeriodoLaboral | null>(null);

  // Pestañas
  const [tabActiva, setTabActiva] = useState<TabTipo>("dashboard");

  // Modal Compartir / Asignar RR.HH.
  const [compartirModalAbierto, setCompartirModalAbierto] = useState(false);

  // Estados de datos por período seleccionado
  const [cargandoPeriodo, setCargandoPeriodo] = useState(false);
  const [matrizData, setMatrizData] = useState<MatrizCumplimientoData | null>(null);
  const [dashboardData, setDashboardData] = useState<CumplimientoDashboardData | null>(null);

  // Modal de Auditoría Completo
  const [modalAuditoriaAbierto, setModalAuditoriaAbierto] = useState(false);
  const [docSeleccionado, setDocSeleccionado] = useState<PeriodoDocumento | null>(null);
  const [sujetoSelNombre, setSujetoSelNombre] = useState("");
  const [sujetoSelRut, setSujetoSelRut] = useState("");
  const [reqSelNombre, setReqSelNombre] = useState("");
  const [historialAuditoria, setHistorialAuditoria] = useState<AuditoriaDocumento[]>([]);
  const [trazabilidadEventos, setTrazabilidadEventos] = useState<TrazabilidadEvento[]>([]);
  const [cargandoTrazabilidad, setCargandoTrazabilidad] = useState(false);

  // Estado para la Bandeja de Auditoría (Día 4, CA 10 & 11)
  const [filtroAuditoria, setFiltroAuditoria] = useState<FiltroAuditoriaTipo>("por_revisar");
  const [busquedaAuditoria, setBusquedaAuditoria] = useState("");

  // Modal rápido de observación (#cl-obs)
  const [modalObsAbierto, setModalObsAbierto] = useState(false);
  const [docParaObservar, setDocParaObservar] = useState<PeriodoDocumento | null>(null);
  const [accionObs, setAccionObs] = useState<"observar" | "rechazar">("observar");
  const [comentarioObs, setComentarioObs] = useState("");
  const [cargandoAccionObs, setCargandoAccionObs] = useState(false);
  const [errorObs, setErrorObs] = useState<string | null>(null);

  // 1. Cargar Contrato y sus Períodos Mensuales generados (CA 2)
  const cargarContratoYPeriodos = useCallback(async () => {
    if (!contratoId) return;
    setCargandoContrato(true);
    try {
      const [cCert, cRaw, persRes] = await Promise.all([
        Api.certificacion.obtenerContrato(contratoId),
        Api.contratos.detalle(contratoId).catch(() => null),
        Api.certificacion.listarPeriodosContrato(contratoId, { orden: "-fecha_inicio" }),
      ]);

      setContrato(cCert);
      setContratoRaw(cRaw);
      const listaPeriodos = persRes.items || [];
      setPeriodos(listaPeriodos);

      // Determinar período activo inicial
      const queryPerId = searchParams.get("periodo");
      if (queryPerId) {
        const encontrado = listaPeriodos.find((p) => p.id === queryPerId);
        if (encontrado) {
          setPeriodoActivo(encontrado);
          return;
        }
      }

      if (cCert.periodo_vigente_id) {
        const vigente = listaPeriodos.find((p) => p.id === cCert.periodo_vigente_id);
        if (vigente) {
          setPeriodoActivo(vigente);
          return;
        }
      }

      if (listaPeriodos.length > 0) {
        setPeriodoActivo(listaPeriodos[0]);
      }
    } catch (err) {
      console.error("Error al cargar contrato y períodos:", err);
    } finally {
      setCargandoContrato(false);
    }
  }, [contratoId, searchParams]);

  useEffect(() => {
    cargarContratoYPeriodos();
  }, [cargarContratoYPeriodos]);

  // Cargar eventos de trazabilidad
  const cargarTrazabilidad = useCallback(async () => {
    if (!periodoActivo?.id) return;
    setCargandoTrazabilidad(true);
    try {
      const eventos = await Api.certificacion.listarTrazabilidad(periodoActivo.id);
      setTrazabilidadEventos(eventos);
    } catch (err) {
      console.error("Error al cargar trazabilidad:", err);
    } finally {
      setCargandoTrazabilidad(false);
    }
  }, [periodoActivo?.id]);

  useEffect(() => {
    if (tabActiva === "trazabilidad") {
      cargarTrazabilidad();
    }
  }, [tabActiva, cargarTrazabilidad]);

  // Recargar datos del período activo
  const recargarDetallesPeriodo = useCallback(async () => {
    if (!periodoActivo?.id) return;
    try {
      const [mat, dash, pActualizado] = await Promise.all([
        Api.certificacion.matrizDocumental(periodoActivo.id).catch(() => null),
        Api.certificacion.dashboardCumplimiento(periodoActivo.id).catch(() => null),
        Api.certificacion.obtenerPeriodo(periodoActivo.id).catch(() => null),
      ]);
      setMatrizData(mat);
      setDashboardData(dash);
      if (pActualizado) {
        setPeriodoActivo(pActualizado);
      }
    } catch (err) {
      console.error("Error al recargar datos del período:", err);
    }
  }, [periodoActivo?.id]);

  // 2. Cargar datos del período activo (Matriz y Dashboard)
  useEffect(() => {
    if (!periodoActivo?.id) return;
    let activo = true;

    async function cargarDetalles() {
      setCargandoPeriodo(true);
      try {
        const [mat, dash] = await Promise.all([
          Api.certificacion.matrizDocumental(periodoActivo!.id).catch(() => null),
          Api.certificacion.dashboardCumplimiento(periodoActivo!.id).catch(() => null),
        ]);
        if (activo) {
          setMatrizData(mat);
          setDashboardData(dash);
        }
      } catch (err) {
        console.error("Error al cargar datos del período:", err);
      } finally {
        if (activo) setCargandoPeriodo(false);
      }
    }

    cargarDetalles();
    return () => {
      activo = false;
    };
  }, [periodoActivo?.id]);

  const volverAContratos = () => {
    if (typeof (window as any).setAppRoute === "function") {
      (window as any).setAppRoute("/certificacion-laboral");
    } else {
      router.push("/certificacion-laboral");
    }
  };

  const abrirModalParaCelda = async (
    sujetoId: string,
    requisitoId: string,
    doc?: PeriodoDocumento
  ) => {
    const sujeto = matrizData?.sujetos.find((s) => s.id === sujetoId);
    const requisito = matrizData?.requisitos.find((r) => r.id === requisitoId);

    setSujetoSelNombre(sujeto?.nombre || "Trabajador");
    setSujetoSelRut(sujeto?.rut || "");
    setReqSelNombre(requisito?.nombre || "Requisito");

    const docActual = doc || {
      id: `doc-${sujetoId}-${requisitoId}`,
      periodo_id: periodoActivo?.id || "",
      sujeto_id: sujetoId,
      sujeto_nombre: sujeto?.nombre || "Trabajador",
      sujeto_rut: sujeto?.rut || "",
      sujeto_cargo: sujeto?.cargo,
      requisito_template_id: requisitoId,
      requisito_nombre: requisito?.nombre || "Requisito",
      estado: "pendiente",
    };

    setDocSeleccionado(docActual);

    try {
      const hist = await Api.certificacion.historialAuditoria(docActual.id);
      setHistorialAuditoria(hist);
    } catch {
      setHistorialAuditoria([]);
    }
    setModalAuditoriaAbierto(true);
  };

  const handleSubirDirecto = async (docId: string, file: File) => {
    if (!periodoActivo) return;
    const urlFake = `https://storage.acredittia.cl/${file.name}`;
    try {
      await Api.certificacion.subirDocumentoDirecto(periodoActivo.id, docId, {
        archivo_url: urlFake,
        archivo_nombre: file.name,
      });
      await recargarDetallesPeriodo();
      if (tabActiva === "trazabilidad") {
        cargarTrazabilidad();
      }
    } catch (err: any) {
      alert(err?.message || "Error en subida directa");
    }
  };

  const exportarTrazabilidadCSV = () => {
    if (!trazabilidadEventos.length) return;
    const encabezados = "Fecha,Usuario,Rol,Accion,Documento,Detalle\n";
    const filas = trazabilidadEventos
      .map(
        (e) =>
          `"${e.fecha}","${e.usuario_nombre}","${e.rol}","${e.accion}","${e.documento_nombre || ""}","${e.detalle}"`
      )
      .join("\n");
    const blob = new Blob([encabezados + filas], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trazabilidad_${periodoActivo?.nombre.replace(/\s+/g, "_") || "periodo"}.csv`;
    a.click();
  };

  const handleSubirDocumento = async (file: File) => {
    if (!docSeleccionado || !periodoActivo) return;
    const celdaKey = `${docSeleccionado.sujeto_id}_${docSeleccionado.requisito_template_id}`;
    const urlFake = `https://storage.acredittia.cl/${file.name}`;

    const docActualizado = await Api.certificacion.subirDocumento(periodoActivo.id, {
      sujeto_id: docSeleccionado.sujeto_id,
      requisito_template_id: docSeleccionado.requisito_template_id,
      archivo_url: urlFake,
    });

    if (matrizData) {
      setMatrizData({
        ...matrizData,
        celdas: {
          ...matrizData.celdas,
          [celdaKey]: docActualizado,
        },
      });
    }
    setDocSeleccionado(docActualizado);
    await recargarDetallesPeriodo();
  };

  const handleAuditarDocumento = async (
    accion: "aprobar" | "observar" | "rechazar" | "no_aplica",
    observacion?: string
  ) => {
    if (!docSeleccionado || !periodoActivo) return;
    try {
      await Api.certificacion.revisarDocumento(periodoActivo.id, docSeleccionado.id, {
        accion,
        comentario: observacion,
      });
      await recargarDetallesPeriodo();
      if (tabActiva === "trazabilidad") {
        cargarTrazabilidad();
      }
    } catch (err: any) {
      alert(err?.message || "Error al revisar documento");
    }
  };

  // Acción rápida desde la tabla de auditoría: Aprobar / No aplica
  const handleAccionRapidaAuditoria = async (
    doc: PeriodoDocumento,
    accion: "aprobar" | "no_aplica"
  ) => {
    if (!periodoActivo) return;
    try {
      await Api.certificacion.revisarDocumento(periodoActivo.id, doc.id, {
        accion,
      });
      await recargarDetallesPeriodo();
      if (tabActiva === "trazabilidad") {
        cargarTrazabilidad();
      }
    } catch (err: any) {
      alert(err?.message || `Error al ejecutar acción ${accion}`);
    }
  };

  // Abrir modal de observación (#cl-obs) desde la tabla de auditoría
  const abrirModalObservacionRapida = (
    doc: PeriodoDocumento,
    accion: "observar" | "rechazar"
  ) => {
    setDocParaObservar(doc);
    setAccionObs(accion);
    setComentarioObs("");
    setErrorObs(null);
    setModalObsAbierto(true);
  };

  // Confirmar observación/rechazo en modal #cl-obs
  const confirmarObservacionRapida = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docParaObservar || !periodoActivo) return;
    if (!comentarioObs.trim()) {
      setErrorObs("El comentario es obligatorio para dictaminar observación o rechazo.");
      return;
    }

    setCargandoAccionObs(true);
    setErrorObs(null);
    try {
      await Api.certificacion.revisarDocumento(periodoActivo.id, docParaObservar.id, {
        accion: accionObs,
        comentario: comentarioObs.trim(),
      });
      setModalObsAbierto(false);
      setDocParaObservar(null);
      setComentarioObs("");
      await recargarDetallesPeriodo();
      if (tabActiva === "trazabilidad") {
        cargarTrazabilidad();
      }
    } catch (err: any) {
      setErrorObs(err?.message || "Error al dictaminar documento");
    } finally {
      setCargandoAccionObs(false);
    }
  };

  // Ver archivo y marcar visto por ADC
  const handleVerArchivoYMarcarVisto = async (doc: PeriodoDocumento) => {
    if (!doc.archivo_url) return;
    if (periodoActivo?.id && doc.id) {
      try {
        await Api.certificacion.marcarDocumentoVisto(periodoActivo.id, doc.id);
      } catch (err) {
        console.warn("No se pudo marcar visto por ADC:", err);
      }
    }
    window.open(doc.archivo_url, "_blank");
  };

  // Regla de Cierre al 100% (Sección 10, CA 12)
  const handleCerrarPeriodo = async () => {
    if (!periodoActivo) return;
    const pct = Math.round(periodoActivo.porcentaje_cumplimiento || 0);

    if (pct < 100) {
      alert(
        `⛔ No es posible cerrar el período: El cumplimiento debe ser del 100% (actualmente ${pct}%).\n` +
        `Aún existen requisitos pendientes de carga, en revisión u observados en este contrato.`
      );
      return;
    }

    const confirmado = window.confirm(
      `¿Confirmar el cierre definitivo del período mensual "${periodoActivo.nombre}"?\n\n` +
      `Al cerrar:\n` +
      `• La nómina y los documentos quedarán archivados de forma inmutable.\n` +
      `• No se admitirán nuevas subidas de archivos ni dictámenes posteriores.\n` +
      `• Quedará registrado en la bitácora de trazabilidad.`
    );
    if (!confirmado) return;

    try {
      const cerrado = await Api.certificacion.cerrarPeriodo(periodoActivo.id);
      alert(`✅ Período "${cerrado.nombre}" cerrado formalmente con 100% de cumplimiento.`);
      await cargarContratoYPeriodos();
      setPeriodoActivo(cerrado);
      await recargarDetallesPeriodo();
    } catch (err: any) {
      alert(err?.message || "Error al cerrar el período");
    }
  };

  // Lista plana de documentos del período para la bandeja de auditoría
  const documentosAuditoria = useMemo(() => {
    if (!matrizData?.celdas) return [];
    return Object.values(matrizData.celdas);
  }, [matrizData?.celdas]);

  // Conteos para los filtros de la bandeja
  const conteosAuditoria = useMemo(() => {
    const porRevisar = documentosAuditoria.filter((d) => d.estado === "en_revision").length;
    const obsRech = documentosAuditoria.filter(
      (d) => d.estado === "observado" || d.estado === "rechazado"
    ).length;
    const aprobados = documentosAuditoria.filter((d) => d.estado === "aprobado").length;
    const todos = documentosAuditoria.length;

    return { porRevisar, obsRech, aprobados, todos };
  }, [documentosAuditoria]);

  // Documentos filtrados en la bandeja
  const documentosAuditoriaFiltrados = useMemo(() => {
    return documentosAuditoria.filter((d) => {
      // 1. Filtro rápido superior
      if (filtroAuditoria === "por_revisar" && d.estado !== "en_revision") return false;
      if (
        filtroAuditoria === "observados_rechazados" &&
        d.estado !== "observado" &&
        d.estado !== "rechazado"
      )
        return false;
      if (filtroAuditoria === "aprobados" && d.estado !== "aprobado") return false;

      // 2. Buscador por texto
      if (busquedaAuditoria.trim()) {
        const term = busquedaAuditoria.toLowerCase().trim();
        const matchSujeto = d.sujeto_nombre.toLowerCase().includes(term);
        const matchRut = d.sujeto_rut.toLowerCase().includes(term);
        const matchReq = d.requisito_nombre.toLowerCase().includes(term);
        if (!matchSujeto && !matchRut && !matchReq) return false;
      }

      return true;
    });
  }, [documentosAuditoria, filtroAuditoria, busquedaAuditoria]);

  if (cargandoContrato) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-12 text-slate-500">
        <Spinner texto="Cargando contrato y períodos de certificación..." />
      </div>
    );
  }

  if (!contrato) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="font-semibold text-slate-700">Contrato no encontrado</p>
        <button
          onClick={volverAContratos}
          className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          ← Volver a Contratos
        </button>
      </div>
    );
  }

  const userActual = typeof window !== "undefined" ? Api.currentUser() : null;
  const esRrhh = userActual?.role === "rrhh";
  const periodoCerrado = periodoActivo?.estado === "cerrado";

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Barra Superior con Retorno */}
      <div className="flex items-center justify-between">
        <button
          onClick={volverAContratos}
          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
        >
          <span>←</span> Volver a Contratos de Certificación Laboral
        </button>
        <span className="font-mono text-xs text-slate-400">
          ID: {contrato.id.slice(0, 8)}...
        </span>
      </div>

      {/* 2. Cabecera del Contrato (Pantalla 2 - CA 2) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                {contrato.codigo || "S/C"}
              </span>
              <Chip
                estado={contrato.estado_contractual || contrato.estado}
                texto={contrato.estado_contractual || contrato.estado}
              />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {contrato.nombre}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Contrato registrado para acreditación y certificación laboral mensual en faena.
            </p>
          </div>

          {!esRrhh && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCompartirModalAbierto(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50/30 transition"
              >
                <span>👥 Compartir / Asignar RR.HH.</span>
              </button>
            </div>
          )}
        </div>

        {/* Metadatos y Roles en la Cabecera */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-5 text-xs">
          <div>
            <span className="block text-slate-400 font-medium">🏢 Empresa Proveedora</span>
            <span className="font-bold text-slate-800">{contrato.empresa_proveedora}</span>
          </div>
          <div>
            <span className="block text-slate-400 font-medium">🏭 Mandante</span>
            <span className="font-bold text-slate-800">
              {contrato.mandante_nombre || contrato.mandante || "Mandante"}
            </span>
          </div>
          <div>
            <span className="block text-slate-400 font-medium">⛰️ Faena</span>
            <span className="font-bold text-slate-800">{contrato.faena_nombre}</span>
          </div>
          <div>
            <span className="block text-slate-400 font-medium">👤 ADC Asignado</span>
            <span className="font-bold text-emerald-700">
              {contrato.adc_asignado || "Andrea Castillo (ADC)"}
            </span>
          </div>
          <div>
            <span className="block text-slate-400 font-medium">👤 Encargado RR.HH.</span>
            <span className="font-bold text-blue-700">
              {contrato.rrhh_asignado || "María Fernández (RR.HH.)"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Tira de Tarjetas Mensuales (.cl-pers / .cl-per) */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span>📅</span> Períodos Mensuales del Contrato
            <span className="text-xs font-normal text-slate-500">
              ({periodos.length} períodos generados según vigencia)
            </span>
          </h2>

          {/* Botón de Cierre de Período al 100% (CA 12, Sección 10) */}
          {periodoActivo && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                Seleccionado: {periodoActivo.nombre}
              </span>

              {periodoCerrado ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-3.5 py-1 text-xs font-bold text-slate-700 shadow-sm">
                  🔒 Período Cerrado e Inmutable
                </span>
              ) : !esRrhh ? (
                <button
                  type="button"
                  onClick={handleCerrarPeriodo}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1 text-xs font-bold shadow-sm transition ${
                    (periodoActivo.porcentaje_cumplimiento || 0) >= 100
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed hover:bg-slate-200 hover:text-slate-600"
                  }`}
                  title={
                    (periodoActivo.porcentaje_cumplimiento || 0) >= 100
                      ? "Cerrar período formalmente (100% de cumplimiento alcanzado)"
                      : `Requiere 100% de cumplimiento para cerrar (actual: ${Math.round(
                          periodoActivo.porcentaje_cumplimiento || 0
                        )}%)`
                  }
                >
                  <span>✓ Cerrar período</span>
                  {(periodoActivo.porcentaje_cumplimiento || 0) >= 100 && (
                    <span className="rounded-full bg-emerald-500 px-1.5 py-0.2 text-[10px] text-white">
                      100%
                    </span>
                  )}
                </button>
              ) : null}
            </div>
          )}
        </div>

        {periodos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
            <p className="text-sm font-semibold">
              No hay períodos mensuales generados para este contrato.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Verifique las fechas de inicio y término del contrato.
            </p>
          </div>
        ) : (
          <div className="cl-pers overflow-x-auto pb-2 flex gap-3">
            {periodos.map((p) => (
              <PeriodoCard
                key={p.id}
                periodo={p}
                activa={periodoActivo?.id === p.id}
                onSelect={(sel) => setPeriodoActivo(sel)}
                variante="strip"
              />
            ))}
          </div>
        )}
      </div>

      {/* 4. Barra de Pestañas Operativas (.cl-tabs) */}
      <div className="cl-tabs flex gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setTabActiva("dashboard")}
          className={`cl-tab ${tabActiva === "dashboard" ? "on !bg-blue-600 !border-blue-600 !text-white" : ""}`}
        >
          📊 Dashboard
        </button>
        <button
          type="button"
          onClick={() => setTabActiva("documentos")}
          className={`cl-tab ${tabActiva === "documentos" ? "on !bg-blue-600 !border-blue-600 !text-white" : ""}`}
        >
          📑 Documentos requeridos
        </button>
        <button
          type="button"
          onClick={() => setTabActiva("nomina")}
          className={`cl-tab ${tabActiva === "nomina" ? "on !bg-blue-600 !border-blue-600 !text-white" : ""}`}
        >
          👥 Nómina e historial
        </button>
        <button
          type="button"
          onClick={() => setTabActiva("auditoria")}
          className={`cl-tab ${tabActiva === "auditoria" ? "on !bg-blue-600 !border-blue-600 !text-white" : ""}`}
        >
          🔍 Auditoría {conteosAuditoria.porRevisar > 0 && `(${conteosAuditoria.porRevisar})`}
        </button>
        <button
          type="button"
          onClick={() => setTabActiva("trazabilidad")}
          className={`cl-tab ${tabActiva === "trazabilidad" ? "on !bg-blue-600 !border-blue-600 !text-white" : ""}`}
        >
          🕓 Trazabilidad
        </button>
      </div>

      {/* 5. Contenido de la Pestaña Activa */}
      {!periodoActivo ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Seleccione un período mensual arriba para ver sus detalles.
        </div>
      ) : cargandoPeriodo ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center p-12 text-slate-500">
          <Spinner texto={`Cargando datos del período ${periodoActivo.nombre}...`} />
        </div>
      ) : (
        <div>
          {/* Pestaña: Dashboard */}
          {tabActiva === "dashboard" && (
            dashboardData ? (
              <CumplimientoDashboard data={dashboardData} />
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <Donut pct={periodoActivo.porcentaje_cumplimiento || 0} size={110} />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{periodoActivo.nombre}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Período mensual desde {periodoActivo.fecha_inicio} hasta {periodoActivo.fecha_fin}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <Chip estado={periodoActivo.estado} texto={periodoActivo.estado} />
                      <span className="font-semibold text-slate-700">
                        {Math.round(periodoActivo.porcentaje_cumplimiento || 0)}% cumplimiento
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {/* Pestaña: Documentos requeridos */}
          {tabActiva === "documentos" && (
            matrizData ? (
              <MatrizDocumental
                data={matrizData}
                onSelectCelda={abrirModalParaCelda}
                onSubirDirecto={handleSubirDirecto}
                onCargaMasiva={() => alert("Carga masiva ZIP activada")}
              />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                No hay matriz documental disponible para este período.
              </div>
            )
          )}

          {/* Pestaña: Nómina e historial (CA 6) */}
          {tabActiva === "nomina" && (
            <TabNominaPeriodo
              contratoId={contratoId}
              periodoId={periodoActivo.id}
              periodoNombre={periodoActivo.nombre}
              periodoEstado={periodoActivo.estado}
            />
          )}

          {/* Pestaña: Auditoría (Día 4, CA 10 & 11) */}
          {tabActiva === "auditoria" && (
            <div className="space-y-4">
              {/* Cabecera y Filtros Rápidos de la Bandeja */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span>🔍</span> Bandeja de Auditoría ADC — Período {periodoActivo.nombre}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Evaluación interactiva de entregas. Toda observación exige comentario y notifica a RR.HH.
                    </p>
                  </div>

                  {/* Buscador */}
                  <div className="relative min-w-[260px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                    <input
                      type="text"
                      placeholder="Buscar por trabajador, RUT o documento..."
                      value={busquedaAuditoria}
                      onChange={(e) => setBusquedaAuditoria(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Filtros de la Bandeja */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFiltroAuditoria("por_revisar")}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                      filtroAuditoria === "por_revisar"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span>📥 Bandeja Por revisar</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        filtroAuditoria === "por_revisar"
                          ? "bg-white text-blue-700 font-extrabold"
                          : "bg-blue-100 text-blue-700 font-bold"
                      }`}
                    >
                      {conteosAuditoria.porRevisar}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFiltroAuditoria("todos")}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
                      filtroAuditoria === "todos"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span>Todos</span>
                    <span className="text-[10px] opacity-75">({conteosAuditoria.todos})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFiltroAuditoria("observados_rechazados")}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
                      filtroAuditoria === "observados_rechazados"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span>Observados / Rechazados</span>
                    <span className="text-[10px] opacity-75">({conteosAuditoria.obsRech})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFiltroAuditoria("aprobados")}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
                      filtroAuditoria === "aprobados"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span>Aprobados</span>
                    <span className="text-[10px] opacity-75">({conteosAuditoria.aprobados})</span>
                  </button>
                </div>
              </div>

              {/* Tabla de Entregas para Auditoría ADC */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                {documentosAuditoriaFiltrados.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs italic">
                    {filtroAuditoria === "por_revisar"
                      ? "🎉 ¡Al día! No hay entregas pendientes de revisión en este período."
                      : "No se encontraron documentos con los filtros seleccionados."}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
                        <tr>
                          <th className="px-4 py-3">Documento Requerido</th>
                          <th className="px-4 py-3">Trabajador / Ámbito</th>
                          <th className="px-4 py-3">Versión</th>
                          <th className="px-4 py-3">Estado</th>
                          <th className="px-4 py-3">Archivo / Apertura</th>
                          <th className="px-4 py-3 text-right">Acciones Rápidas (ADC)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {documentosAuditoriaFiltrados.map((doc) => {
                          const tieneArchivo = Boolean(doc.archivo_url);

                          return (
                            <tr
                              key={doc.id}
                              className={`transition-colors ${
                                doc.estado === "en_revision"
                                  ? "bg-blue-50/20 hover:bg-blue-50/40"
                                  : "hover:bg-slate-50/70"
                              }`}
                            >
                              {/* Documento */}
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-900">{doc.requisito_nombre}</div>
                                {doc.observaciones && (
                                  <div className="mt-1 text-[11px] text-amber-800 line-clamp-1 italic">
                                    Obs: "{doc.observaciones}"
                                  </div>
                                )}
                              </td>

                              {/* Trabajador / Ámbito */}
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-800">{doc.sujeto_nombre}</div>
                                {doc.sujeto_rut && (
                                  <div className="font-mono text-[10px] text-slate-400">
                                    RUT: {doc.sujeto_rut}
                                  </div>
                                )}
                              </td>

                              {/* Versión */}
                              <td className="px-4 py-3">
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold font-mono text-[10px] text-slate-700 border border-slate-200">
                                  v{doc.version || 1}
                                </span>
                              </td>

                              {/* Estado */}
                              <td className="px-4 py-3">
                                <Chip estado={doc.estado} texto={doc.estado} />
                              </td>

                              {/* Archivo / Apertura */}
                              <td className="px-4 py-3">
                                {tieneArchivo ? (
                                  <div className="flex flex-col gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleVerArchivoYMarcarVisto(doc)}
                                      className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 text-[11px]"
                                    >
                                      <span>👁 Ver archivo</span>
                                    </button>
                                    <span className="text-[10px] text-slate-400">
                                      {doc.abierto_por_adc ? "Visto por ADC" : "⏳ No abierto"}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">Sin archivo</span>
                                )}
                              </td>

                              {/* Acciones Rápidas */}
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  {!periodoCerrado ? (
                                    !esRrhh ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleAccionRapidaAuditoria(doc, "aprobar")}
                                          className="cl-b ok !py-1 !px-2 !text-[11px]"
                                          title="Aprobar requisito"
                                        >
                                          ✓ Aprobar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => abrirModalObservacionRapida(doc, "observar")}
                                          className="cl-b ob !py-1 !px-2 !text-[11px]"
                                          title="Observar entrega (comentario obligatorio)"
                                        >
                                          📝 Observar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => abrirModalObservacionRapida(doc, "rechazar")}
                                          className="cl-b re !py-1 !px-2 !text-[11px]"
                                          title="Rechazar entrega (comentario obligatorio)"
                                        >
                                          ⛔ Rechazar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleAccionRapidaAuditoria(doc, "no_aplica")}
                                          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                                          title="Marcar No aplica"
                                        >
                                          No aplica
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-[11px] text-slate-400 italic">Solo lectura (RR.HH.)</span>
                                    )
                                  ) : (
                                    <span className="text-[11px] text-slate-400 italic">Cerrado</span>
                                  )}

                                  {/* Botón Ver Historial / Modal Completo */}
                                  <button
                                    type="button"
                                    onClick={() => abrirModalParaCelda(doc.sujeto_id, doc.requisito_template_id, doc)}
                                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                                    title="Ver historial de versiones y auditoría"
                                  >
                                    📚 Historial
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pestaña: Trazabilidad */}
          {tabActiva === "trazabilidad" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>🕓</span> Registro Cronológico de Trazabilidad ({periodoActivo.nombre})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Historial inmutable de auditoría: quién, qué, cuándo y resultado de cada entrega (CA 4).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cargarTrazabilidad}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                  >
                    ↻ Actualizar
                  </button>
                  <button
                    type="button"
                    onClick={exportarTrazabilidadCSV}
                    className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                  >
                    📥 Exportar CSV
                  </button>
                </div>
              </div>

              {cargandoTrazabilidad ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                  <Spinner texto="Cargando bitácora de trazabilidad..." />
                </div>
              ) : trazabilidadEventos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 italic">
                  No hay eventos registrados aún para este período.
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Fecha y Hora</th>
                        <th className="px-4 py-3">Actor / Rol</th>
                        <th className="px-4 py-3">Acción</th>
                        <th className="px-4 py-3">Documento</th>
                        <th className="px-4 py-3">Detalle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {trazabilidadEventos.map((ev) => (
                        <tr key={ev.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {ev.fecha ? ev.fecha.replace("T", " ").slice(0, 19) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">{ev.usuario_nombre}</div>
                            <div className="text-[10px] text-slate-400 font-medium">{ev.rol}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                              <span>{ev.icono}</span> {ev.accion}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {ev.documento_nombre || "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{ev.detalle}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal Compartir / Asignar RR.HH. */}
      {compartirModalAbierto && (
        <CompartirContratoModal
          abierto={compartirModalAbierto}
          onCerrar={() => setCompartirModalAbierto(false)}
          contrato={contratoRaw}
          puedeGestionar={true}
        />
      )}

      {/* Modal Rápido de Observación Obligatoria (#cl-obs, CA 11) */}
      {modalObsAbierto && docParaObservar && (
        <Modal
          abierto={modalObsAbierto}
          titulo={`Dictamen ADC: ${accionObs === "observar" ? "📝 Observar Entrega" : "⛔ Rechazar Entrega"}`}
          onCerrar={() => setModalObsAbierto(false)}
          ancho="max-w-lg"
        >
          <form onSubmit={confirmarObservacionRapida} className="space-y-4 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-[11px] font-bold text-blue-700 uppercase">
                {docParaObservar.requisito_nombre}
              </span>
              <h4 className="text-sm font-bold text-slate-900">{docParaObservar.sujeto_nombre}</h4>
              <p className="font-mono text-slate-500">v{docParaObservar.version || 1}</p>
            </div>

            {errorObs && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 font-medium text-rose-700">
                ⚠️ {errorObs}
              </div>
            )}

            <div>
              <label htmlFor="cl-obs-rapido" className="block font-bold text-slate-800 mb-1">
                Motivo / Comentario Obligatorio para RR.HH. <span className="text-rose-600">*</span>
              </label>
              <textarea
                id="cl-obs-rapido"
                rows={4}
                required
                value={comentarioObs}
                onChange={(e) => setComentarioObs(e.target.value)}
                placeholder="Indique con claridad las correcciones requeridas para que el Encargado de RR.HH. subsane la entrega..."
                className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                ℹ️ Esta observación será enviada de inmediato al Encargado de RR.HH. y aparecerá en su bandeja <strong>Mis pendientes</strong>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalObsAbierto(false)}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={cargandoAccionObs}
                className={`rounded-xl px-4 py-2 font-bold text-white shadow-sm transition disabled:opacity-50 ${
                  accionObs === "observar" ? "bg-amber-600 hover:bg-amber-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {cargandoAccionObs ? "Dictaminando..." : `Confirmar ${accionObs === "observar" ? "Observación" : "Rechazo"}`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Completo de Auditoría y Versiones */}
      <AuditoriaModal
        abierto={modalAuditoriaAbierto}
        onCerrar={() => setModalAuditoriaAbierto(false)}
        periodoId={periodoActivo?.id}
        doc={docSeleccionado}
        sujetoNombre={sujetoSelNombre}
        sujetoRut={sujetoSelRut}
        requisitoNombre={reqSelNombre}
        onSubirDocumento={handleSubirDocumento}
        onAuditar={handleAuditarDocumento}
        historial={historialAuditoria}
        periodoCerrado={periodoCerrado}
      />
    </div>
  );
}
