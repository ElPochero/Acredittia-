"use client";

import React, { useEffect, useState } from "react";
import * as Api from "@/lib/cliente";
import { abrirDescarga } from "@/lib/api";
import type { RequisitoFila, Ambito, TipoRequisito, EstadoCalc } from "@/lib/tipos";

type RequisitoFilaExt = RequisitoFila & {
  codigo?: string;
  aplica_a?: string | null;
  vencimiento?: string | null;
};

export default function RequisitosPage() {
  const [loading, setLoading] = useState(true);
  const [requisitosList, setRequisitosList] = useState<RequisitoFilaExt[]>([]);
  const [kpis, setKpis] = useState<{
    total: number;
    activos: number;
    por_vencer_30d: number;
    vencidos: number;
  } | null>(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [ambitoFilter, setAmbitoFilter] = useState("todos");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [sortFilter, setSortFilter] = useState("ambito");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal de Detalle / Nuevo / Editar Requisito
  const [selectedReq, setSelectedReq] = useState<RequisitoFilaExt | null>(null);
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<TipoRequisito>("legal");
  const [nuevoAmbito, setNuevoAmbito] = useState<Ambito>("personal");
  const [nuevoObligatorio, setNuevoObligatorio] = useState(true);
  const [nuevoArchivoEjemplo, setNuevoArchivoEjemplo] = useState<File | null>(null);
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevoVigencia, setNuevoVigencia] = useState("");
  const [nuevoPlataforma, setNuevoPlataforma] = useState("");
  const [nuevoAplicaA, setNuevoAplicaA] = useState("");

  // Edición
  const [editingReq, setEditingReq] = useState<RequisitoFilaExt | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editTipo, setEditTipo] = useState<TipoRequisito>("legal");
  const [editAmbito, setEditAmbito] = useState<Ambito>("personal");
  const [editObligatorio, setEditObligatorio] = useState(true);
  const [editArchivoEjemplo, setEditArchivoEjemplo] = useState<File | null>(null);
  const [editArchivoEjemploRuta, setEditArchivoEjemploRuta] = useState<string | null>(null);
  const [editCodigo, setEditCodigo] = useState("");
  const [editVigencia, setEditVigencia] = useState("");
  const [editPlataforma, setEditPlataforma] = useState("");
  const [editAplicaA, setEditAplicaA] = useState("");

  const fetchRequisitos = async () => {
    setLoading(true);
    try {
      const params: any = {
        page_size: pageSize,
        page: currentPage,
      };

      if (search.trim()) params.search = search.trim();
      if (tipoFilter !== "todos") params.tipo = tipoFilter;
      if (ambitoFilter !== "todos") params.ambito = ambitoFilter;
      if (estadoFilter !== "todos") params.estado = estadoFilter;
      if (sortFilter) params.sort = sortFilter;

      const res = await Api.requisitos.listar(params);
      setRequisitosList(res.items || []);
      setTotalCount(res.total || (res.items || []).length);
      if (res.kpis) {
        setKpis({
          total: Number(res.kpis.total || 0),
          activos: Number(res.kpis.activos || 0),
          por_vencer_30d: Number(res.kpis.por_vencer_30d || 0),
          vencidos: Number(res.kpis.vencidos || 0),
        });
      }
    } catch (err) {
      console.error("Error al cargar requisitos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisitos();
  }, [search, tipoFilter, ambitoFilter, estadoFilter, sortFilter, pageSize, currentPage]);

  // Cálculos KPI
  const kpiTotal = kpis?.total ?? totalCount ?? 0;
  const kpiActivos = kpis?.activos ?? 0;
  const kpiPorVencer = kpis?.por_vencer_30d ?? 0;
  const kpiVencidos = kpis?.vencidos ?? 0;
  const kpiInactivos = Math.max(0, kpiTotal - (kpiActivos + kpiPorVencer + kpiVencidos));

  const pctActivos = kpiTotal > 0 ? Math.round((kpiActivos / kpiTotal) * 100) : 0;
  const pctPorVencer = kpiTotal > 0 ? Math.round((kpiPorVencer / kpiTotal) * 100) : 0;
  const pctVencidos = kpiTotal > 0 ? Math.round((kpiVencidos / kpiTotal) * 100) : 0;
  const pctInactivos = kpiTotal > 0 ? Math.round((kpiInactivos / kpiTotal) * 100) : 0;

  // Mapeo visual de tipos
  const formatearTipoBadge = (tipo: string | null) => {
    const val = (tipo || "legal").toLowerCase();
    switch (val) {
      case "legal":
        return { label: "Legal", cls: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
      case "medico":
        return { label: "Médico", cls: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
      case "capacitacion":
        return { label: "Capacitación", cls: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
      case "certificacion":
        return { label: "Certificación", cls: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
      case "tecnico":
        return { label: "Técnico", cls: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
      case "medioambiental":
        return { label: "Medioambiental", cls: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
      default:
        return { label: tipo || "General", cls: "bg-slate-100 text-slate-700 border border-slate-200" };
    }
  };

  // Mapeo visual de ámbitos
  const formatearAmbitoLabel = (ambito: string) => {
    switch (ambito) {
      case "personal":
        return "Personal";
      case "equipo":
        return "Equipos / Vehículos";
      case "empresa":
        return "Empresa";
      case "emsipor":
        return "Licencia Interna";
      default:
        return ambito;
    }
  };

  // Mapeo visual de Aplicable A
  const formatearAplicableA = (r: RequisitoFilaExt) => {
    if (r.aplica_a) return r.aplica_a;
    if (r.ambito === "personal") return "Todos los cargos";
    if (r.ambito === "equipo") return "Vehículos y Equipos";
    if (r.ambito === "empresa") return "Empresa";
    return "Todos";
  };

  // Mapeo visual de estado
  const formatearEstadoBadge = (estado: EstadoCalc) => {
    switch (estado) {
      case "ok":
        return { label: "Activo", cls: "bg-emerald-100 text-emerald-800 font-bold" };
      case "porvenc":
        return { label: "Por vencer", cls: "bg-amber-100 text-amber-800 font-bold" };
      case "venc":
        return { label: "Vencido", cls: "bg-red-100 text-red-800 font-bold" };
      case "falta":
        return { label: "Inactivo / Pendiente", cls: "bg-amber-50 text-amber-900 border border-amber-200 font-bold" };
      default:
        return { label: "Activo", cls: "bg-emerald-100 text-emerald-800 font-bold" };
    }
  };

  // Código formateado
  const formatearCodigo = (r: RequisitoFilaExt, index: number) => {
    if (r.codigo) return r.codigo;
    const num = String(index + 1).padStart(3, "0");
    return `REQ-${num}`;
  };

  const uploadEjemplo = async (file: File): Promise<string> => {
    // 1. Obtener SAS
    const res = await fetch(`${Api.getBaseUrl()}/api/v1/requisitos/templates/upload-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
      },
      body: JSON.stringify({
        filename: file.name,
        size_bytes: file.size,
        content_type: file.type,
      })
    });
    if (!res.ok) throw new Error("No se pudo obtener URL de subida");
    const { upload_url, blob_path, headers } = await res.json();

    // 2. Subir archivo
    const putRes = await fetch(upload_url, {
      method: "PUT",
      headers: { ...headers, "Content-Type": file.type },
      body: file
    });
    if (!putRes.ok) throw new Error("No se pudo subir el archivo");
    return blob_path;
  };

  const handleCrearRequisito = async () => {
    if (!nuevoTitulo.trim()) return;
    try {
      let archivo_ejemplo;
      if (nuevoArchivoEjemplo) {
        archivo_ejemplo = await uploadEjemplo(nuevoArchivoEjemplo);
      }

      if (Api.requisitos.crearPlantilla) {
        await Api.requisitos.crearPlantilla({
          titulo: nuevoTitulo.trim(),
          tipo: nuevoTipo,
          ambito: nuevoAmbito,
          obligatorio: nuevoObligatorio,
          archivo_ejemplo,
          codigo: nuevoCodigo.trim() || undefined,
          vigencia_meses: nuevoVigencia ? parseInt(nuevoVigencia, 10) : undefined,
          plataforma: nuevoPlataforma.trim() || undefined,
          aplica_a: nuevoAplicaA.trim() || undefined,
        });
      } else {
        await Api.admin.crearPlantilla({
          titulo: nuevoTitulo.trim(),
          tipo: nuevoTipo,
          ambito: nuevoAmbito,
          obligatorio: nuevoObligatorio,
          archivo_ejemplo,
          codigo: nuevoCodigo.trim() || undefined,
          vigencia_meses: nuevoVigencia ? parseInt(nuevoVigencia, 10) : undefined,
          plataforma: nuevoPlataforma.trim() || undefined,
          aplica_a: nuevoAplicaA.trim() || undefined,
        });
      }
      setShowNuevoModal(false);
      setNuevoTitulo("");
      setNuevoArchivoEjemplo(null);
      setNuevoCodigo("");
      setNuevoVigencia("");
      setNuevoPlataforma("");
      setNuevoAplicaA("");
      fetchRequisitos();
      if (typeof window !== "undefined" && (window as any).toast) {
        (window as any).toast("Requisito creado exitosamente para tu empresa");
      }
    } catch (err: any) {
      alert(err.message || "Error al crear plantilla de requisito");
    }
  };

  const handleAbrirEditar = (r: RequisitoFilaExt) => {
    setEditingReq(r);
    setEditTitulo(r.titulo);
    setEditTipo((r.tipo as TipoRequisito) || "legal");
    setEditAmbito(r.ambito);
    setEditObligatorio(r.obligatorio);
    setEditArchivoEjemplo(null);
    setEditArchivoEjemploRuta(r.archivo_ejemplo || null);
    setEditCodigo(r.codigo || "");
    setEditVigencia(r.vigencia_meses ? String(r.vigencia_meses) : "");
    setEditPlataforma(r.plataforma || "");
    setEditAplicaA(r.aplica_a || "");
  };

  const handleEditarRequisito = async () => {
    if (!editingReq || !editTitulo.trim()) return;
    try {
      let archivo_ejemplo = editArchivoEjemploRuta;
      if (editArchivoEjemplo) {
        archivo_ejemplo = await uploadEjemplo(editArchivoEjemplo);
      }

      if (Api.requisitos.editarPlantilla) {
        await Api.requisitos.editarPlantilla(editingReq.template_id, {
          titulo: editTitulo.trim(),
          tipo: editTipo,
          ambito: editAmbito,
          obligatorio: editObligatorio,
          archivo_ejemplo: archivo_ejemplo || undefined,
          codigo: editCodigo.trim() || undefined,
          vigencia_meses: editVigencia ? parseInt(editVigencia, 10) : undefined,
          plataforma: editPlataforma.trim() || undefined,
          aplica_a: editAplicaA.trim() || undefined,
        });
      } else {
        await Api.admin.editarPlantilla(editingReq.template_id, {
          titulo: editTitulo.trim(),
          tipo: editTipo,
          ambito: editAmbito,
          obligatorio: editObligatorio,
          archivo_ejemplo: archivo_ejemplo || undefined,
          codigo: editCodigo.trim() || undefined,
          vigencia_meses: editVigencia ? parseInt(editVigencia, 10) : undefined,
          plataforma: editPlataforma.trim() || undefined,
          aplica_a: editAplicaA.trim() || undefined,
        });
      }
      setEditingReq(null);
      fetchRequisitos();
      if (typeof window !== "undefined" && (window as any).toast) {
        (window as any).toast("Requisito actualizado exitosamente");
      }
    } catch (err: any) {
      alert(err.message || "Error al actualizar el requisito");
    }
  };

  const handleEliminarRequisito = async (r: RequisitoFilaExt) => {
    if (confirm(`¿Estás seguro de eliminar el requisito "${r.titulo}" de tu catálogo de empresa?`)) {
      try {
        if (Api.requisitos.eliminarPlantilla) {
          await Api.requisitos.eliminarPlantilla(r.template_id);
        } else {
          await Api.admin.eliminarPlantilla(r.template_id);
        }
        fetchRequisitos();
        if (typeof window !== "undefined" && (window as any).toast) {
          (window as any).toast("Requisito eliminado exitosamente");
        }
      } catch (err: any) {
        alert(err.message || "Error al eliminar el requisito");
      }
    }
  };

  const handleExportar = async () => {
    try {
      const r = await Api.exportaciones.crear({ recurso: "requisitos", filtros: {} });
      if (!r.download_url) {
        // 202: por encima de EXPORT_FILAS_MAX el job queda encolado
        (window as any).toast?.("Exportación en proceso. Te avisaremos cuando esté lista.");
        return;
      }
      // anchor cruzado tras await no descarga fiable; pasamos el archivo a blob
      const res = await fetch(r.download_url);
      if (!res.ok) throw new Error("No se pudo generar el archivo (" + res.status + ")");
      const url = URL.createObjectURL(await res.blob());
      abrirDescarga(url, r.filename);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      (window as any).toast?.(err.message || "Error al generar la exportación");
    }
  };

  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="w-full space-y-6 text-slate-800">
      {/* 1. Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:justify-end gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleExportar}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <span>↓</span> Exportar
          </button>
          <button
            onClick={() => setShowNuevoModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <span>+</span> Nuevo requisito
          </button>
        </div>
      </div>

      {/* 2. Tarjetas KPI de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Requisitos */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="w-11 h-11 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0">
            📋
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Total requisitos</div>
            <div className="text-2xl font-bold text-slate-900 leading-tight">
              {loading ? "..." : kpiTotal}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">en tu empresa</div>
          </div>
        </div>

      </div>

      {/* 3. Barra de Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        {/* Buscador */}
        <div className="flex-1 min-w-[240px]">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Buscar requisito por nombre, código o tipo..."
            className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Filtro Tipo */}
        <select
          value={tipoFilter}
          onChange={(e) => {
            setTipoFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          <option value="todos">Tipo: Todos</option>
          <option value="legal">Legal</option>
          <option value="medico">Médico</option>
          <option value="capacitacion">Capacitación</option>
          <option value="certificacion">Certificación</option>
          <option value="tecnico">Técnico</option>
          <option value="medioambiental">Medioambiental</option>
        </select>

        {/* Filtro Ámbito */}
        <select
          value={ambitoFilter}
          onChange={(e) => {
            setAmbitoFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          <option value="todos">Ámbito: Todos</option>
          <option value="personal">Personal</option>
          <option value="equipo">Equipos / Vehículos</option>
          <option value="empresa">Empresa</option>
          <option value="emsipor">Licencia Interna</option>
        </select>

        {/* Orden */}
        <select
          value={sortFilter}
          onChange={(e) => {
            setSortFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ml-auto"
        >
          <option value="ambito">Ordenar: Por defecto</option>
          <option value="-created_at">Más recientes primero</option>
          <option value="created_at">Más antiguos primero</option>
          <option value="titulo">Nombre (A-Z)</option>
          <option value="-titulo">Nombre (Z-A)</option>
        </select>
      </div>

      {/* 4. Tabla Principal de Requisitos */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Requisito</th>
                <th className="py-3 px-3">Código</th>
                <th className="py-3 px-3">Tipo</th>
                <th className="py-3 px-3">Ámbito</th>
                <th className="py-3 px-3">Obligatorio</th>
                <th className="py-3 px-3">Aplicable a</th>
                <th className="py-3 px-3 text-center">Documentos Asociados</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400 text-xs">
                    Cargando catálogo de requisitos...
                  </td>
                </tr>
              ) : requisitosList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400 text-xs space-y-2">
                    <div>No se encontraron requisitos que coincidan con los filtros.</div>
                  </td>
                </tr>
              ) : (
                requisitosList.map((r, index) => {
                  const tipoBadge = formatearTipoBadge(r.tipo);
                  const estadoBadge = formatearEstadoBadge(r.estado);
                  const codigo = formatearCodigo(r, index);
                  const aplicableA = formatearAplicableA(r);

                  return (
                    <tr key={r.template_id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Requisito */}
                      <td className="py-3.5 px-4 min-w-[220px]">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 text-sm shrink-0">
                            📋
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{r.titulo}</div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                              {r.titulo}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Código */}
                      <td className="py-3.5 px-3 font-semibold text-slate-600 whitespace-nowrap">
                        {codigo}
                      </td>

                      {/* Tipo */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md ${tipoBadge.cls}`}>
                          {tipoBadge.label}
                        </span>
                      </td>

                      {/* Ámbito */}
                      <td className="py-3.5 px-3 text-slate-600 font-medium whitespace-nowrap">
                        {formatearAmbitoLabel(r.ambito)}
                      </td>

                      {/* Obligatorio */}
                      <td className="py-3.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                        {r.obligatorio ? "Sí" : "No"}
                      </td>

                      {/* Aplicable a */}
                      <td className="py-3.5 px-3 text-slate-600 font-medium whitespace-nowrap">
                        {aplicableA}
                      </td>

                      {/* Documentos Asociados */}
                      <td className="py-3.5 px-3 text-center font-bold text-slate-900 text-sm whitespace-nowrap">
                        {r.docs || 0}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedReq(r)}
                            title="Ver detalle"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => handleAbrirEditar(r)}
                            title="Editar requisito"
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleEliminarRequisito(r)}
                            title="Eliminar requisito"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pie de Tabla / Paginación */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Mostrando {totalCount > 0 ? startIndex : 0} a {endIndex} de {totalCount} requisitos
          </div>
          <div className="flex items-center gap-3">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white font-medium text-slate-700"
            >
              <option value={10}>10 por página</option>
              <option value={25}>25 por página</option>
              <option value={50}>50 por página</option>
            </select>
          </div>
        </div>
      </div>

      {/* Modal de Detalle Requisito */}
      {selectedReq && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">{selectedReq.titulo}</h3>
              <button
                onClick={() => setSelectedReq(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="font-medium text-slate-400">Ámbito:</span>
                <span className="font-bold text-slate-800">{formatearAmbitoLabel(selectedReq.ambito)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="font-medium text-slate-400">Tipo:</span>
                <span className="font-bold text-slate-800">{selectedReq.tipo || "General"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="font-medium text-slate-400">Obligatorio:</span>
                <span className="font-bold text-slate-800">{selectedReq.obligatorio ? "Sí" : "No"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="font-medium text-slate-400">Vigencia recomendada:</span>
                <span className="font-bold text-slate-800">
                  {selectedReq.vigencia_meses ? `${selectedReq.vigencia_meses} meses` : "Sin vencimiento fijo"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="font-medium text-slate-400">Documentos Totales:</span>
                <span className="font-bold text-slate-800">{selectedReq.docs || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="font-medium text-slate-400">Acreditados OK:</span>
                <span className="font-bold text-emerald-600">{selectedReq.ok || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="font-medium text-slate-400">Por vencer:</span>
                <span className="font-bold text-amber-600">{selectedReq.porvenc || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="font-medium text-slate-400">Vencidos:</span>
                <span className="font-bold text-red-600">{selectedReq.venc || 0}</span>
              </div>
              {selectedReq.archivo_ejemplo && (
                <div className="flex justify-between py-1">
                  <span className="font-medium text-slate-400">Archivo de Ejemplo:</span>
                  <a href={`${Api.getBaseUrl()}/api/v1/blobs/download?blob_path=${encodeURIComponent(selectedReq.archivo_ejemplo)}`} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">
                    Ver Archivo
                  </a>
                </div>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedReq(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Requisito */}
      {showNuevoModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">+ Nuevo Requisito</h3>
              <button
                onClick={() => setShowNuevoModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre del Requisito</label>
                <input
                  type="text"
                  value={nuevoTitulo}
                  onChange={(e) => setNuevoTitulo(e.target.value)}
                  placeholder="Ej: Licencia de Conducir A4"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipo</label>
                <select
                  value={nuevoTipo}
                  onChange={(e) => setNuevoTipo(e.target.value as TipoRequisito)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="legal">Legal</option>
                  <option value="medico">Médico</option>
                  <option value="capacitacion">Capacitación</option>
                  <option value="certificacion">Certificación</option>
                  <option value="tecnico">Técnico</option>
                  <option value="medioambiental">Medioambiental</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ámbito</label>
                <select
                  value={nuevoAmbito}
                  onChange={(e) => setNuevoAmbito(e.target.value as Ambito)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="personal">Personal</option>
                  <option value="equipo">Equipos / Vehículos</option>
                  <option value="empresa">Empresa</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Código (Opcional)</label>
                  <input
                    type="text"
                    value={nuevoCodigo}
                    onChange={(e) => setNuevoCodigo(e.target.value)}
                    placeholder="Ej: R-01"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vigencia (Meses)</label>
                  <input
                    type="number"
                    value={nuevoVigencia}
                    onChange={(e) => setNuevoVigencia(e.target.value)}
                    placeholder="Ej: 12"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Plataforma (Opcional)</label>
                  <input
                    type="text"
                    value={nuevoPlataforma}
                    onChange={(e) => setNuevoPlataforma(e.target.value)}
                    placeholder="Ej: Autocontrol"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Aplica A (Opcional)</label>
                  <input
                    type="text"
                    value={nuevoAplicaA}
                    onChange={(e) => setNuevoAplicaA(e.target.value)}
                    placeholder="Ej: Conductores"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="oblig"
                  checked={nuevoObligatorio}
                  onChange={(e) => setNuevoObligatorio(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="oblig" className="font-semibold text-slate-700">
                  Obligatorio para la acreditación
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Archivo de Ejemplo (Opcional)</label>
                <input
                  type="file"
                  onChange={(e) => setNuevoArchivoEjemplo(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setShowNuevoModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrearRequisito}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs"
              >
                Guardar Requisito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Requisito */}
      {editingReq && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">✏️ Editar Requisito</h3>
              <button
                onClick={() => setEditingReq(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre del Requisito</label>
                <input
                  type="text"
                  value={editTitulo}
                  onChange={(e) => setEditTitulo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipo</label>
                <select
                  value={editTipo}
                  onChange={(e) => setEditTipo(e.target.value as TipoRequisito)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="legal">Legal</option>
                  <option value="medico">Médico</option>
                  <option value="capacitacion">Capacitación</option>
                  <option value="certificacion">Certificación</option>
                  <option value="tecnico">Técnico</option>
                  <option value="medioambiental">Medioambiental</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ámbito</label>
                <select
                  value={editAmbito}
                  onChange={(e) => setEditAmbito(e.target.value as Ambito)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="personal">Personal</option>
                  <option value="equipo">Equipos / Vehículos</option>
                  <option value="empresa">Empresa</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Código (Opcional)</label>
                  <input
                    type="text"
                    value={editCodigo}
                    onChange={(e) => setEditCodigo(e.target.value)}
                    placeholder="Ej: R-01"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vigencia (Meses)</label>
                  <input
                    type="number"
                    value={editVigencia}
                    onChange={(e) => setEditVigencia(e.target.value)}
                    placeholder="Ej: 12"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Plataforma (Opcional)</label>
                  <input
                    type="text"
                    value={editPlataforma}
                    onChange={(e) => setEditPlataforma(e.target.value)}
                    placeholder="Ej: Autocontrol"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Aplica A (Opcional)</label>
                  <input
                    type="text"
                    value={editAplicaA}
                    onChange={(e) => setEditAplicaA(e.target.value)}
                    placeholder="Ej: Conductores"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editOblig"
                  checked={editObligatorio}
                  onChange={(e) => setEditObligatorio(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="editOblig" className="font-semibold text-slate-700">
                  Obligatorio para la acreditación
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Archivo de Ejemplo (Opcional)</label>
                <input
                  type="file"
                  onChange={(e) => setEditArchivoEjemplo(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {editArchivoEjemploRuta && !editArchivoEjemplo && (
                  <div className="mt-1 text-xs text-slate-500">
                    Archivo actual: <a href={`${Api.getBaseUrl()}/api/v1/blobs/download?blob_path=${encodeURIComponent(editArchivoEjemploRuta)}`} target="_blank" rel="noreferrer" className="text-blue-600 underline">Descargar</a>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setEditingReq(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditarRequisito}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

