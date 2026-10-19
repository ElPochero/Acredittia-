"use client";

import React, { useEffect, useState } from "react";
import * as Api from "@/lib/cliente";
import type { Reporte } from "@/lib/tipos";

export default function ReportesPage() {
  const [loading, setLoading] = useState(true);
  const [reportesList, setReportesList] = useState<Reporte[]>([]);

  useEffect(() => {
    async function fetchReportes() {
      setLoading(true);
      try {
        const res = await Api.reportes.listar({ page_size: 50 });
        setReportesList(res.items || []);
      } catch (err) {
        console.error("Error al cargar reportes:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchReportes();
  }, []);

  const total = reportesList.length;

  return (
    <div className="p-6 space-y-6">
      {/* Título único en AppHeader; sin cabecera duplicada */}

      {!loading && total === 0 && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <span className="text-xl">⚠️</span>
          <div className="space-y-1">
            <h4 className="font-bold text-sm">Sin datos de reportes generados</h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              No se encontraron archivos o reportes generados anteriormente en la base de datos.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-3.5">Nombre del Reporte</th>
              <th className="p-3.5">Tipo</th>
              <th className="p-3.5">Formato</th>
              <th className="p-3.5">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-400">
                  Cargando reportes...
                </td>
              </tr>
            ) : reportesList.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-400">
                  No hay reportes generados en la base de datos.
                </td>
              </tr>
            ) : (
              reportesList.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="p-3.5 font-bold text-slate-800">{r.nombre}</td>
                  <td className="p-3.5 text-slate-600">{r.tipo}</td>
                  <td className="p-3.5 text-slate-500 uppercase">{r.formato}</td>
                  <td className="p-3.5 text-emerald-600 font-medium">{r.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
