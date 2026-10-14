"use client";

import React, { useEffect, useState } from "react";
import * as Api from "@/lib/cliente";
import { NuevaModalContrato } from "@/components/contratos/NuevaModalContrato";
import { ContratosTable, estadoVigencia, type EstadoVig } from "@/components/contratos/ContratosTable";
import { Modal } from "@/components/ui";
import type { Contrato } from "@/lib/tipos";

export default function ContratosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contratosList, setContratosList] = useState<Contrato[]>([]);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<"Todos" | EstadoVig>("Todos");
  const [faenaFilter, setFaenaFilter] = useState("Todas");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [deleteTarget, setDeleteTarget] = useState<Contrato | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchContratos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await Api.contratos.listar({ page_size: 50 });
      setContratosList(res.items || []);
    } catch (err) {
      console.error("Error al cargar contratos:", err);
      setError(Api.mensajeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContratos();
  }, []);

  const handleDelete = (id: string, nombre: string) => {
    const target = contratosList.find((c) => c.id === id);
    if (target) setDeleteTarget(target);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await Api.contratos.eliminar(deleteTarget.id);
      setDeleteTarget(null);
      fetchContratos();
    } catch (e) {
      alert(Api.mensajeError(e));
    } finally {
      setDeleting(false);
    }
  };

  const filtered = contratosList.filter((c) => {
    if (search) {
      const term = search.toLowerCase();
      const match =
        c.nombre?.toLowerCase().includes(term) ||
        c.codigo?.toLowerCase().includes(term) ||
        c.faena?.nombre?.toLowerCase().includes(term);
      if (!match) return false;
    }
    if (estadoFilter !== "Todos" && estadoVigencia(c) !== estadoFilter) return false;
    if (faenaFilter !== "Todas" && c.faena?.nombre !== faenaFilter) return false;
    return true;
  });

  const total = contratosList.length;
  const vig = contratosList.map((c) => estadoVigencia(c));
  const activos = vig.filter((v) => v === "Vigente").length;
  const porVencer = vig.filter((v) => v === "Por vencer").length;
  const vencidos = vig.filter((v) => v === "Vencido").length;

  const faenasDistintas = Array.from(new Set(contratosList.map((c) => c.faena?.nombre).filter(Boolean)));

  const kpis = [
    { titulo: "Total contratos", valor: total, icono: "📋", fondo: "bg-slate-100/80", sub: "de todos los contratos" },
    { titulo: "Contratos activos", valor: activos, icono: "✅", fondo: "bg-emerald-500/15", sub: `${total ? Math.round((activos / total) * 100) : 0}% del total`, subClase: "text-emerald-600" },
    { titulo: "Por vencer (próx. 90 días)", valor: porVencer, icono: "⏳", fondo: "bg-amber-500/15", sub: `${total ? Math.round((porVencer / total) * 100) : 0}% del total`, subClase: "text-amber-600" },
    { titulo: "Vencidos", valor: vencidos, icono: "❌", fondo: "bg-red-500/15", sub: `${total ? Math.round((vencidos / total) * 100) : 0}% del total`, subClase: "text-red-600" },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto pb-20">
      {/* Encabezado de la vista */}
      <div className="view-head">
        <div>
          <h2 className="text-[#0F172A]">Contratos</h2>
          <p>Administra todos los contratos de tu empresa en sus diferentes faenas.</p>
        </div>
        <div className="view-head-actions">
          <div className="flex bg-slate-100 p-1 rounded-[10px] mr-1">
            <button
              onClick={() => setViewMode("table")}
              aria-pressed={viewMode === "table"}
              className={`px-3 py-1.5 rounded-lg text-[0.8rem] font-bold transition-all ${viewMode === "table" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Tabla
            </button>
            <button
              onClick={() => setViewMode("grid")}
              aria-pressed={viewMode === "grid"}
              className={`px-3 py-1.5 rounded-lg text-[0.8rem] font-bold transition-all ${viewMode === "grid" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Tarjetas
            </button>
          </div>
          <button
            className="btn-outline"
            onClick={() => alert("Exportar — próximamente")}
          >
            ↓ Exportar
          </button>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            + Nuevo contrato
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {kpis.map((k) => (
          <div key={k.titulo} className="bg-white border border-slate-200 rounded-[14px] px-5 py-[18px] flex gap-4 shadow-sm items-center">
            <div className={`w-[46px] h-[46px] rounded-[12px] flex items-center justify-center text-[1.3rem] flex-shrink-0 ${k.fondo}`} aria-hidden="true">
              {k.icono}
            </div>
            <div className="min-w-0">
              <div className="text-[0.75rem] text-slate-500 font-medium mb-0.5">{k.titulo}</div>
              <div className="text-[1.7rem] font-black text-[#0F172A] leading-none mb-1">{k.valor}</div>
              <div className={`text-[0.7rem] font-medium ${k.subClase ?? "text-slate-400"}`}>{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="view-filters">
        <input
          type="text"
          className="view-search"
          placeholder="Buscar contrato, faena o estado..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="view-select"
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value as "Todos" | EstadoVig)}
        >
          <option value="Todos">Estado: Todos</option>
          <option value="Vigente">Vigente</option>
          <option value="Por iniciar">Por iniciar</option>
          <option value="Por vencer">Por vencer</option>
          <option value="Vencido">Vencido</option>
        </select>
        <select className="view-select" value={faenaFilter} onChange={(e) => setFaenaFilter(e.target.value)}>
          <option value="Todas">Faena: Todas</option>
          {faenasDistintas.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <span aria-hidden="true">⚠️</span>
          <div className="text-[0.85rem]">
            <b className="block">No se pudieron cargar los contratos.</b>
            <span>{error}</span>
          </div>
          <button onClick={fetchContratos} className="ml-auto rounded-lg border border-red-300 px-3 py-1 text-[0.8rem] font-semibold hover:bg-red-100">
            Reintentar
          </button>
        </div>
      )}

      {/* Tabla / Tarjetas */}
      <ContratosTable
        contratos={filtered}
        loading={loading}
        total={total}
        onDelete={handleDelete}
        viewMode={viewMode}
      />

      <NuevaModalContrato abierto={isModalOpen} onCerrar={() => setIsModalOpen(false)} />

      {/* Modal de eliminación (C3) */}
      <Modal
        abierto={!!deleteTarget}
        titulo={
          <span className="flex items-center gap-2.5 text-red-600">
            <span className="w-9 h-9 bg-red-100 rounded-[10px] grid place-items-center text-[1.1rem]" aria-hidden="true">🗑</span>
            Eliminar contrato
          </span>
        }
        onCerrar={() => setDeleteTarget(null)}
        ancho="max-w-[480px]"
      >
        {deleteTarget && (
          <div>
            <div className="text-[0.85rem] text-slate-500">
              ¿Estás seguro de que deseas eliminar el contrato{" "}
              <strong className="text-[#1E293B]">{deleteTarget.nombre}</strong>?
            </div>

            {(() => {
              const perCt = deleteTarget.stats?.personal?.total || 0;
              const eqCt = deleteTarget.stats?.equipos?.total || 0;
              if (!perCt && !eqCt) {
                return <div className="text-[0.82rem] text-slate-500 my-3.5">Este contrato no tiene personal ni equipos asociados.</div>;
              }
              return (
                <div className="bg-amber-50 border border-amber-300 rounded-[10px] p-3 my-3.5 text-[0.8rem] text-amber-800 leading-relaxed">
                  <strong>⚠️ Este contrato tiene datos asociados:</strong>
                  {perCt > 0 && <div>• {perCt} trabajador(es) en el roster</div>}
                  {eqCt > 0 && <div>• {eqCt} equipo(s)/vehículo(s) en el roster</div>}
                  <div>Al eliminar el contrato se eliminarán también estos registros.</div>
                </div>
              );
            })()}

            <div className="flex gap-3 mt-4">
              <button
                className="flex-1 rounded-[10px] border border-slate-200 bg-white py-2.5 text-[0.88rem] font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setDeleteTarget(null)}
              >
                Cancelar
              </button>
              <button
                className="flex-1 rounded-[10px] bg-red-600 py-2.5 text-[0.88rem] font-bold text-white hover:bg-red-700 disabled:opacity-50"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? "Eliminando..." : "Sí, eliminar contrato"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
