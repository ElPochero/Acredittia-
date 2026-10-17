"use client";

import React, { useEffect, useState } from "react";
import * as Api from "@/lib/cliente";
import type {
  Kpis,
  CumplimientoContrato,
  AcreditacionesEstado,
  Alerta,
  ProximoVencimiento,
  ActividadFila,
  Tendencia,
  Usuario,
} from "@/lib/tipos";
import DashboardKpis from "@/components/dashboard/DashboardKpis";
import VigiaBanner from "@/components/dashboard/VigiaBanner";
import AccionesPendientesCard from "@/components/dashboard/AccionesPendientesCard";
import CumplimientoContratosTable from "@/components/dashboard/CumplimientoContratosTable";
import AlertasImportantesCard from "@/components/dashboard/AlertasImportantesCard";
import AcreditacionesEstadoCard from "@/components/dashboard/AcreditacionesEstadoCard";
import ActividadRecienteCard from "@/components/dashboard/ActividadRecienteCard";
import ProximosVencimientosCard from "@/components/dashboard/ProximosVencimientosCard";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<Usuario | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [acreditaciones, setAcreditaciones] = useState<AcreditacionesEstado | null>(null);
  const [contratos, setContratos] = useState<CumplimientoContrato[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [vencimientos, setVencimientos] = useState<ProximoVencimiento[]>([]);
  const [actividades, setActividades] = useState<ActividadFila[]>([]);
  const [tendencia, setTendencia] = useState<Tendencia | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    setUser(Api.currentUser());

    async function loadData() {
      setLoading(true);
      setApiError(null);
      try {
        const [
          kpisRes, acreditacionesRes, contratosRes, alertasRes,
          vencimientosRes, actividadRes, tendenciaRes,
        ] = await Promise.allSettled([
          Api.dashboard.kpis(),
          Api.dashboard.acreditacionesEstado(),
          Api.dashboard.cumplimientoContratos({ page_size: 10 }),
          Api.alertas.listar({ page_size: 10, solo_activas: true }),
          Api.dashboard.proximosVencimientos({ page_size: 5, dias: 30 }),
          Api.dashboard.actividad({ page_size: 5 }),
          Api.dashboard.tendencia({ periodo: "semana" }),
        ]);

        if (kpisRes.status === "fulfilled") setKpis(kpisRes.value);
        if (acreditacionesRes.status === "fulfilled") setAcreditaciones(acreditacionesRes.value);
        if (contratosRes.status === "fulfilled") setContratos(contratosRes.value.items || []);
        if (alertasRes.status === "fulfilled") setAlertas(alertasRes.value.items || []);
        if (vencimientosRes.status === "fulfilled") setVencimientos(vencimientosRes.value.items || []);
        if (actividadRes.status === "fulfilled") setActividades(actividadRes.value.items || []);
        if (tendenciaRes.status === "fulfilled") setTendencia(tendenciaRes.value);

        if (kpisRes.status === "rejected") {
          const reason = (kpisRes as PromiseRejectedResult).reason as Error | undefined;
          setApiError(reason?.message || "Sesión expirada o error de conexión.");
        }
      } catch (err) {
        console.error("Error al cargar datos del dashboard:", err);
        setApiError(err instanceof Error ? err.message : "Error al conectar con la API.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="w-full space-y-6 text-slate-800">
      {apiError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-center gap-3 text-xs" role="alert">
          <span aria-hidden="true">❌</span>
          <div><b>Conexión backend:</b> {apiError}</div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Hola, {user?.email || "demo@acredittia.cl"}!
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Aquí tienes el resumen de tu operación minera.</p>
      </div>

      <DashboardKpis kpis={kpis} tendencia={tendencia} loading={loading} />
      <VigiaBanner />
      <AccionesPendientesCard alertas={alertas} loading={loading} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7">
          <CumplimientoContratosTable contratos={contratos} loading={loading} />
        </div>
        <div className="xl:col-span-5">
          <AlertasImportantesCard alertas={alertas} loading={loading} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AcreditacionesEstadoCard data={acreditaciones} loading={loading} />
        <ActividadRecienteCard actividades={actividades} loading={loading} />
        <ProximosVencimientosCard vencimientos={vencimientos} loading={loading} />
      </div>
    </div>
  );
}
