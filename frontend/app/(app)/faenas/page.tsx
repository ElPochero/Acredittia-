"use client";

import React, { useEffect, useState } from "react";
import * as Api from "@/lib/cliente";
import type { Faena } from "@/lib/tipos";

export default function FaenasPage() {
  const [loading, setLoading] = useState(true);
  const [faenasList, setFaenasList] = useState<Faena[]>([]);

  useEffect(() => {
    async function fetchFaenas() {
      setLoading(true);
      try {
        const res = await Api.faenas.listar({ page_size: 50 });
        setFaenasList(res.items || []);
      } catch (err) {
        console.error("Error al cargar faenas:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchFaenas();
  }, []);

  const total = faenasList.length;

  return (
    <div className="p-6 space-y-6">
      {/* Título único en AppHeader; sin cabecera duplicada */}

      {!loading && total === 0 && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <span className="text-xl">⚠️</span>
          <div className="space-y-1">
            <h4 className="font-bold text-sm">Sin datos de faenas en la base de datos</h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              No se encontraron faenas registradas actualmente en la base de datos.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-3.5">Faena</th>
              <th className="p-3.5">Mandante</th>
              <th className="p-3.5">Región</th>
              <th className="p-3.5">Sector</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-400">
                  Cargando faenas...
                </td>
              </tr>
            ) : faenasList.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-400">
                  No hay faenas registradas en la base de datos.
                </td>
              </tr>
            ) : (
              faenasList.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50/50">
                  <td className="p-3.5 font-bold text-slate-800">{f.nombre}</td>
                  <td className="p-3.5 text-slate-600">{f.mandante || "Sin mandante"}</td>
                  <td className="p-3.5 text-slate-500">{f.region || "N/A"}</td>
                  <td className="p-3.5 text-slate-500">{f.sector || "General"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
