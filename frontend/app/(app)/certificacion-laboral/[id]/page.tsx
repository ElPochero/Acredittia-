"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as Api from "@/lib/cliente";
import type {
  MatrizCumplimientoData,
  PeriodoDocumento,
  CumplimientoDashboardData,
  AuditoriaDocumento,
} from "@/lib/tipos";
import MatrizDocumental from "@/components/MatrizDocumental";
import AuditoriaModal from "@/components/AuditoriaModal";
import CumplimientoDashboard from "@/components/CumplimientoDashboard";
import { Chip, Spinner, Donut } from "@/components/ui";

export default function PeriodoDetallePage() {
  const params = useParams();
  const router = useRouter();
  const periodoId = (params?.id as string) || "per-sep-2026";

  const [tabActiva, setTabActiva] = useState<"matriz" | "auditoria" | "dashboard">("matriz");
  const [matrizData, setMatrizData] = useState<MatrizCumplimientoData | null>(null);
  const [dashboardData, setDashboardData] = useState<CumplimientoDashboardData | null>(null);
  const [cargando, setCargando] = useState(true);

  // Auditoria Modal State
  const [modalAuditoriaAbierto, setModalAuditoriaAbierto] = useState(false);
  const [docSeleccionado, setDocSeleccionado] = useState<PeriodoDocumento | null>(null);
  const [sujetoSelNombre, setSujetoSelNombre] = useState("");
  const [sujetoSelRut, setSujetoSelRut] = useState("");
  const [reqSelNombre, setReqSelNombre] = useState("");
  const [historialAuditoria, setHistorialAuditoria] = useState<AuditoriaDocumento[]>([]);

  const cargarPeriodo = async () => {
    setCargando(true);
    try {
      const [mat, dash] = await Promise.all([
        Api.certificacion.matrizDocumental(periodoId),
        Api.certificacion.dashboardCumplimiento(periodoId),
      ]);
      setMatrizData(mat);
      setDashboardData(dash);
    } catch (err) {
      console.error("Error al cargar detalle de período:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPeriodo();
  }, [periodoId]);

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
      periodo_id: periodoId,
      sujeto_id: sujetoId,
      sujeto_nombre: sujeto?.nombre || "Trabajador",
      sujeto_rut: sujeto?.rut || "",
      sujeto_cargo: sujeto?.cargo,
      requisito_template_id: requisitoId,
      requisito_nombre: requisito?.nombre || "Requisito",
      estado: "pendiente",
    };

    setDocSeleccionado(docActual);

    // Cargar historial
    const hist = await Api.certificacion.historialAuditoria(docActual.id);
    setHistorialAuditoria(hist);
    setModalAuditoriaAbierto(true);
  };

  const handleSubirDocumento = async (file: File) => {
    if (!docSeleccionado || !matrizData) return;
    const celdaKey = `${docSeleccionado.sujeto_id}_${docSeleccionado.requisito_template_id}`;

    // Fake a cloud URL for the demo
    const urlFake = `https://storage.acredittia.cl/${file.name}`;
    
    // Call the backend to save the document
    const docActualizado = await Api.certificacion.subirDocumento(periodoId, {
      sujeto_id: docSeleccionado.sujeto_id,
      requisito_template_id: docSeleccionado.requisito_template_id,
      archivo_url: urlFake
    });

    // Actualizar estado local
    setMatrizData({
      ...matrizData,
      celdas: {
        ...matrizData.celdas,
        [celdaKey]: docActualizado,
      },
    });
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

    // Actualizar matriz localmente
    setMatrizData({
      ...matrizData,
      celdas: {
        ...matrizData.celdas,
        [celdaKey]: docActualizado,
      },
    });

    // Re-calcular porcentaje de cumplimiento
    recalcularMatriz({
      ...matrizData,
      celdas: {
        ...matrizData.celdas,
        [celdaKey]: docActualizado,
      },
    });
  };

  const recalcularMatriz = (nuevaMatriz: MatrizCumplimientoData) => {
    const totalCeldas = nuevaMatriz.sujetos.length * nuevaMatriz.requisitos.length;
    let aprob = 0;
    Object.values(nuevaMatriz.celdas).forEach((c) => {
      if (c.estado === "aprobado") aprob++;
    });

    const pct = Math.round((aprob / (totalCeldas || 1)) * 100);
    setMatrizData({
      ...nuevaMatriz,
      periodo: {
        ...nuevaMatriz.periodo,
        porcentaje_cumplimiento: pct,
      },
    });
  };

  const volverAPeriodos = () => {
    if (typeof (window as any).setAppRoute === "function") {
      (window as any).setAppRoute("/certificacion-laboral");
    } else {
      router.push("/certificacion-laboral");
    }
  };

  if (cargando) return <Spinner texto="Cargando información del período..." />;
  if (!matrizData)
    return (
      <div className="p-8 text-center text-slate-500">
        No se encontró la información del período.
      </div>
    );

  const { periodo } = matrizData;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumbs & Back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={volverAPeriodos}
          className="flex items-center gap-1.5 text-xs font-semibold text-cyan-700 hover:text-cyan-800 transition-colors"
        >
          <span>←</span> Volver a Lista de Períodos Laborales
        </button>
        <span className="text-xs font-medium text-slate-400">
          ID Período: {periodo.id}
        </span>
      </div>

      {/* Main Period Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <Donut pct={periodo.porcentaje_cumplimiento || 0} size={110} />
          <div>
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-slate-400">
              {periodo.contrato_nombre || "Contrato Minero"}
            </span>
            <h1 className="text-2xl font-bold text-slate-900">{periodo.nombre}</h1>
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
              <span>📅 {periodo.fecha_inicio} al {periodo.fecha_fin}</span>
              <span className="capitalize bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-600">
                {periodo.tipo}
              </span>
              <Chip estado={periodo.estado} />
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTabActiva("matriz")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              tabActiva === "matriz"
                ? "bg-cyan-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            🟩 Matriz Documental
          </button>
          <button
            onClick={() => setTabActiva("auditoria")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              tabActiva === "auditoria"
                ? "bg-cyan-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            📋 Auditoría & Revisiones
          </button>
          <button
            onClick={() => setTabActiva("dashboard")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              tabActiva === "dashboard"
                ? "bg-cyan-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            📊 Dashboard Cumplimiento
          </button>
        </div>
      </div>

      {/* Tab Content Views */}
      {tabActiva === "matriz" && (
        <MatrizDocumental
          data={matrizData}
          onSelectCelda={abrirModalParaCelda}
          onCargaMasiva={() => alert("Función de carga masiva ZIP activada para la demo.")}
        />
      )}

      {tabActiva === "auditoria" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>📋</span> Centro de Auditoría de Revisiones del Período
          </h3>
          <p className="text-xs text-slate-500">
            Haz clic en cualquiera de los trabajadores abajo para evaluar sus documentos o emitir observaciones de cierre de período.
          </p>

          <div className="divide-y divide-slate-100">
            {matrizData.sujetos.map((s) => (
              <div key={s.id} className="py-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{s.nombre}</h4>
                  <p className="text-xs text-slate-500 font-mono">
                    RUT: {s.rut} • Cargo: {s.cargo || "Sin cargo"}
                  </p>
                </div>
                <button
                  onClick={() => abrirModalParaCelda(s.id, matrizData.requisitos[0]?.id)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
                >
                  🔍 Revisar Documentos
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tabActiva === "dashboard" && dashboardData && (
        <CumplimientoDashboard data={dashboardData} />
      )}

      {/* Audit & File Upload Modal */}
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
