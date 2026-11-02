"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import * as Api from "@/lib/cliente";
import type {
  Contrato,
  ContratoCertificacionLaboral,
  PeriodoLaboral,
  MatrizCumplimientoData,
  PeriodoDocumento,
  CumplimientoDashboardData,
  AuditoriaDocumento, TrazabilidadEvento,
} from "@/lib/tipos";
import PeriodoCard from "@/components/PeriodoCard";
import TabNominaPeriodo from "@/components/certificacion/TabNominaPeriodo";
import MatrizDocumental from "@/components/MatrizDocumental";
import AuditoriaModal from "@/components/AuditoriaModal";
import CumplimientoDashboard from "@/components/CumplimientoDashboard";
import { CompartirContratoModal } from "@/components/contratos/CompartirContratoModal";
import { Chip, Spinner, Donut } from "@/components/ui";

type TabTipo = "dashboard" | "documentos" | "nomina" | "auditoria" | "trazabilidad";

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

  // Modal de Auditoría
  const [modalAuditoriaAbierto, setModalAuditoriaAbierto] = useState(false);
  const [docSeleccionado, setDocSeleccionado] = useState<PeriodoDocumento | null>(null);
  const [sujetoSelNombre, setSujetoSelNombre] = useState("");
  const [sujetoSelRut, setSujetoSelRut] = useState("");
  const [reqSelNombre, setReqSelNombre] = useState("");
  const [historialAuditoria, setHistorialAuditoria] = useState<AuditoriaDocumento[]>([]);
  const [trazabilidadEventos, setTrazabilidadEventos] = useState<TrazabilidadEvento[]>([]);
  const [cargandoTrazabilidad, setCargandoTrazabilidad] = useState(false);

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
      // Recargar matriz, dashboard y contrato
      const [mat, dash] = await Promise.all([
        Api.certificacion.matrizDocumental(periodoActivo.id),
        Api.certificacion.dashboardCumplimiento(periodoActivo.id),
      ]);
      setMatrizData(mat);
      setDashboardData(dash);
      if (tabActiva === "trazabilidad") {
        cargarTrazabilidad();
      }
    } catch (err) {
      console.error("Error en subida directa:", err);
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
  };

  const handleAuditarDocumento = async (
    accion: "aprobar" | "observar" | "rechazar",
    observacion?: string
  ) => {
    if (!docSeleccionado || !matrizData) return;
    await Api.certificacion.auditarDocumento(docSeleccionado.id, { accion, observacion });

    const nuevoEstado =
      accion === "aprobar" ? "aprobado" : accion === "observar" ? "observado" : "rechazado";
    const celdaKey = `${docSeleccionado.sujeto_id}_${docSeleccionado.requisito_template_id}`;

    const docActualizado: PeriodoDocumento = {
      ...docSeleccionado,
      estado: nuevoEstado,
      observaciones: observacion || null,
    };

    setMatrizData({
      ...matrizData,
      celdas: {
        ...matrizData.celdas,
        [celdaKey]: docActualizado,
      },
    });
  };

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

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Barra Superior con Botón de Retorno */}
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
              <Chip estado={contrato.estado_contractual || contrato.estado} texto={contrato.estado_contractual || contrato.estado} />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {contrato.nombre}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Contrato registrado para acreditación y certificación laboral mensual en faena.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCompartirModalAbierto(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50/30 transition"
            >
              <span>👥 Compartir / Asignar RR.HH.</span>
            </button>
          </div>
        </div>

        {/* Metadatos y Roles en la Cabecera */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-5 text-xs">
          <div>
            <span className="block text-slate-400 font-medium">🏢 Empresa Proveedora</span>
            <span className="font-bold text-slate-800">{contrato.empresa_proveedora}</span>
          </div>
          <div>
            <span className="block text-slate-400 font-medium">🏭 Mandante</span>
            <span className="font-bold text-slate-800">{contrato.mandante_nombre || contrato.mandante || "Mandante"}</span>
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span>📅</span> Períodos Mensuales del Contrato
            <span className="text-xs font-normal text-slate-500">
              ({periodos.length} períodos generados según vigencia)
            </span>
          </h2>
          {periodoActivo && (
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              Seleccionado: {periodoActivo.nombre}
            </span>
          )}
        </div>

        {periodos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
            <p className="text-sm font-semibold">No hay períodos mensuales generados para este contrato.</p>
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
          🔍 Auditoría
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

          {/* Pestaña: Auditoría */}
          {tabActiva === "auditoria" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>📋</span> Centro de Auditoría de Revisiones del Período {periodoActivo.nombre}
              </h3>
              <p className="text-xs text-slate-500">
                Bandeja de auditoría del ADC. Seleccione un documento para evaluar y dictaminar observaciones o aprobaciones.
              </p>
              {matrizData && matrizData.sujetos.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {matrizData.sujetos.map((s) => (
                    <div key={s.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{s.nombre}</h4>
                        <p className="text-xs text-slate-500 font-mono">
                          RUT: {s.rut} • Cargo: {s.cargo || "Sin cargo"}
                        </p>
                      </div>
                      <button
                        onClick={() => abrirModalParaCelda(s.id, matrizData.requisitos[0]?.id)}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition"
                      >
                        🔍 Revisar Documentos
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 py-4">No hay trabajadores para auditar en este período.</div>
              )}
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
                          <td className="px-4 py-3 text-slate-600">
                            {ev.detalle}
                          </td>
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

      {/* Modal de Auditoría de Documentos */}
      <AuditoriaModal
        abierto={modalAuditoriaAbierto}
        onCerrar={() => setModalAuditoriaAbierto(false)}
        doc={docSeleccionado}
        sujetoNombre={sujetoSelNombre}
        sujetoRut={sujetoSelRut}
        requisitoNombre={reqSelNombre}
        onSubirDocumento={handleSubirDocumento}
        onAuditar={handleAuditarDocumento}
        historial={historialAuditoria}
      />
    </div>
  );
}
