"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as Api from "@/lib/cliente";
import type { Alerta, AlertaPatch, OrigenAlerta, ParamsAlertas, ResumenAlertas } from "@/lib/tipos";
import { Chip, Modal, SEVERIDAD_LABEL } from "@/components/ui";

const ORIGEN_LBL: Record<string, string> = {
  vencimiento: "Vencimiento", ia: "IA", integracion: "Integración", sistema: "Sistema",
};

const TABS = ["Todas", "Críticas", "Advertencias", "Informativas", "Resueltas"] as const;

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

/** Aplica un cambio del usuario antes de que responda el backend. */
function aplicar(a: Alerta, cambios: AlertaPatch): Alerta {
  const ahora = new Date().toISOString();
  const resuelta = cambios.resuelta ?? a.resuelta;
  return {
    ...a,
    leida: cambios.leida ?? a.leida,
    resuelta,
    estado:
      cambios.estado ??
      (cambios.resuelta === true ? "resuelta" : cambios.resuelta === false ? "nueva" : a.estado),
    leida_at: cambios.leida === undefined ? a.leida_at : cambios.leida ? ahora : null,
    resuelta_at: cambios.resuelta === undefined ? a.resuelta_at : resuelta ? ahora : null,
  };
}

export default function AlertasPage() {
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState<Alerta[]>([]);
  const [resumen, setResumen] = useState<ResumenAlertas | null>(null);
  const [tab, setTab] = useState<string>("Todas");
  const [q, setQ] = useState("");
  const [origen, setOrigen] = useState("Todos");
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [detalle, setDetalle] = useState<Alerta | null>(null);
  const [abrirId, setAbrirId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  /** Filtros de la pestaña activa, resueltos por el backend. */
  function filtros(): ParamsAlertas {
    const base: ParamsAlertas = {
      page: pagina,
      page_size: 20,
      search: q.trim() || undefined,
      origen: origen === "Todos" ? undefined : (origen as OrigenAlerta),
    };
    if (tab === "Resueltas") return { ...base, estado: "resuelta", solo_activas: false };
    if (tab === "Críticas") return { ...base, severidad: "critica" };
    if (tab === "Advertencias") return { ...base, severidad: "advertencia,alta" };
    if (tab === "Informativas") return { ...base, severidad: "informativa,media,baja" };
    return base;
  }

  /** Cambiar de pestaña vuelve a la primera página. */
  function cambiarTab(t: string) {
    setTab(t);
    setPagina(1);
  }

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const [pag, res] = await Promise.all([
        Api.alertas.listar(filtros()),
        Api.alertas.resumen(),
      ]);
      setLista(pag.items || []);
      setTotal(pag.total || 0);
      setTotalPaginas(pag.total_pages || 1);
      setResumen(res);
    } catch (e) {
      setError(Api.mensajeError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Filtros que llegan desde el Home. Se leen del `window` porque la página
    // es cliente y `useSearchParams` obligaría a envolverla en un `Suspense`.
    const sp = new URLSearchParams(window.location.search);
    const f = sp.get("filtro");
    const estado = sp.get("estado");
    const inicial = f === "criticas" || estado === "criticas" ? "Críticas"
      : f === "resueltas" || estado === "resueltas" ? "Resueltas"
      : "Todas";
    setTab(inicial);
    setAbrirId(sp.get("alerta"));
  }, []);

  useEffect(() => {
    const t = setTimeout(cargar, q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, origen, pagina, q]);

  function reemplazar(a: Alerta) {
    setLista((prev) => prev.map((x) => (x.id === a.id ? a : x)));
    setDetalle((d) => (d?.id === a.id ? a : d));
  }

  async function marcarLeida(a: Alerta) {
    if (a.leida) return;
    reemplazar(aplicar(a, { leida: true }));
    try {
      reemplazar(await Api.alertas.editar(a.id, { leida: true }));
    } catch (e) {
      reemplazar(a);
      setError(Api.mensajeError(e));
    }
  }

  async function cambiar(a: Alerta, cambios: AlertaPatch) {
    setGuardando(true);
    setError("");
    reemplazar(aplicar(a, cambios));
    try {
      const r = await Api.alertas.editar(a.id, cambios);
      reemplazar(r);
      setAviso(
        r.resuelta ? `Alerta resuelta: ${r.titulo}` : `Alerta actualizada: ${r.titulo}`,
      );
      if (r.resuelta) setDetalle(null);
      await cargar();
    } catch (e) {
      reemplazar(a);
      setError(Api.mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  async function marcarTodas() {
    setError("");
    try {
      const { marcadas } = await Api.alertas.marcarLeidas();
      setAviso(`${marcadas} alerta(s) marcadas como leídas`);
      await cargar();
    } catch (e) {
      setError(Api.mensajeError(e));
    }
  }

  // La alerta pedida por URL (`?alerta=…`) se abre una vez que llegó el listado.
  useEffect(() => {
    if (!abrirId || loading) return;
    const a = lista.find((x) => x.id === abrirId);
    setAbrirId(null);
    if (!a) return;
    setDetalle(a);
    marcarLeida(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirId, loading, lista]);

  const filtradas = lista;

  const kpis = [
    { label: "Pendientes", valor: resumen?.activas ?? 0, color: "text-slate-800", sub: "sin resolver", tab: "Todas" },
    { label: "Críticas", valor: resumen?.criticas ?? 0, color: "text-red-500", sub: "requieren atención", tab: "Críticas" },
    { label: "Advertencias", valor: resumen?.advertencias ?? 0, color: "text-amber-500", sub: "por vencer o altas", tab: "Advertencias" },
    { label: "Resueltas (30 días)", valor: resumen?.resueltas_30d ?? 0, color: "text-emerald-600", sub: "últimos 30 días", tab: "Resueltas" },
  ];

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <button
          onClick={() => (window as any).setAppRoute?.("/dashboard")}
          className="text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
        >
          ← Volver a Inicio
        </button>
        <button
          onClick={marcarTodas}
          disabled={loading || (resumen?.no_leidas ?? 0) === 0}
          className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ✓ Marcar todas como leídas
          {resumen?.no_leidas ? (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700">{resumen.no_leidas}</span>
          ) : null}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm" role="alert">
          {error}
        </div>
      )}
      {aviso && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm" role="status">
          {aviso}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <button
            key={k.label}
            onClick={() => cambiarTab(k.tab)}
            aria-pressed={tab === k.tab}
            className={`bg-white p-5 rounded-xl border shadow-sm text-left transition-colors ${
              tab === k.tab ? "border-blue-400 ring-1 ring-blue-200" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">{k.label}</div>
            <div className={`text-3xl font-bold ${k.color}`}>{k.valor}</div>
            <div className="text-xs text-slate-400 font-medium mt-1">{k.sub}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => cambiarTab(t)}
            aria-pressed={tab === t}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${
              tab === t ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t}
            {t === "Críticas" && resumen?.criticas ? (
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${tab === t ? "bg-red-500 text-white" : "bg-red-100 text-red-600"}`}>
                {resumen.criticas}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            type="text"
            placeholder="Buscar alerta por palabra clave..."
            aria-label="Buscar alerta"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPagina(1); }}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={origen}
          onChange={(e) => { setOrigen(e.target.value); setPagina(1); }}
          aria-label="Filtrar por origen"
          className="bg-white border border-slate-200 text-slate-600 text-sm rounded-lg px-3 py-2 outline-none"
        >
          <option value="Todos">Tipo: Todos</option>
          {Object.entries(ORIGEN_LBL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-4 whitespace-nowrap">Prioridad</th>
              <th className="px-4 py-4">Alerta</th>
              <th className="px-4 py-4 whitespace-nowrap">Tipo</th>
              <th className="px-4 py-4">Contrato</th>
              <th className="px-4 py-4 whitespace-nowrap">Fecha</th>
              <th className="px-4 py-4 whitespace-nowrap">Estado</th>
              <th className="px-4 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mb-2"></div>
                  <p>Cargando alertas...</p>
                </td>
              </tr>
            ) : filtradas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No hay alertas que coincidan con los filtros.
                </td>
              </tr>
            ) : (
              filtradas.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <Chip estado={a.severidad} texto={SEVERIDAD_LABEL[a.severidad]} />
                  </td>
                  <td className="px-4 py-4 min-w-[250px]">
                    <button onClick={() => { setDetalle(a); marcarLeida(a); }} className="text-left">
                      <div className="font-bold text-slate-800 hover:text-blue-700">{a.titulo}</div>
                      <div className="text-xs text-slate-500 mt-1 line-clamp-1">{a.descripcion || "Sin descripción"}</div>
                    </button>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-xs">{ORIGEN_LBL[a.origen] || a.origen}</td>
                  <td className="px-4 py-4 text-xs min-w-[150px]">
                    {a.contrato_id ? (
                      <Link href={`/contratos/${a.contrato_id}?tab=alertas-ia`} className="font-semibold text-blue-600 hover:text-blue-800">
                        Ver contrato
                      </Link>
                    ) : (
                      <span className="text-slate-500">General</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs whitespace-nowrap text-slate-500">{fecha(a.created_at)}</td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <Chip estado={a.estado} />
                    {!a.leida && <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-blue-500" title="No leída" aria-label="No leída" />}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => { setDetalle(a); marcarLeida(a); }}
                        className="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded"
                      >
                        Ver
                      </button>
                      {a.resuelta ? (
                        <button
                          onClick={() => cambiar(a, { resuelta: false })}
                          disabled={guardando}
                          className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded disabled:opacity-50"
                        >
                          Reabrir
                        </button>
                      ) : (
                        <button
                          onClick={() => cambiar(a, { resuelta: true })}
                          disabled={guardando}
                          className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded disabled:opacity-50"
                        >
                          Resolver
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <nav aria-label="Paginación de alertas" className="flex items-center justify-between gap-3 text-xs text-slate-600">
          <span>
            {total} alerta(s) · página {pagina} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1 || loading}
              className="px-3 py-1.5 font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={pagina >= totalPaginas || loading}
              className="px-3 py-1.5 font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              Siguiente →
            </button>
          </div>
        </nav>
      )}

      <Modal
        abierto={!!detalle}
        titulo={detalle?.titulo ?? "Alerta"}
        onCerrar={() => setDetalle(null)}
        ancho="max-w-2xl"
      >
        {detalle && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Chip estado={detalle.severidad} texto={SEVERIDAD_LABEL[detalle.severidad]} />
              <Chip estado={detalle.estado} />
              <Chip estado="informativa" texto={ORIGEN_LBL[detalle.origen] || detalle.origen} />
            </div>
            <p className="text-slate-600 whitespace-pre-line">{detalle.descripcion || "Sin descripción."}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
              <div><dt className="inline font-semibold">Creada: </dt><dd className="inline">{fecha(detalle.created_at)}</dd></div>
              <div><dt className="inline font-semibold">Leída: </dt><dd className="inline">{detalle.leida_at ? fecha(detalle.leida_at) : "No"}</dd></div>
              <div><dt className="inline font-semibold">Resuelta: </dt><dd className="inline">{detalle.resuelta_at ? fecha(detalle.resuelta_at) : "No"}</dd></div>
              <div>
                <dt className="inline font-semibold">Contrato: </dt>
                <dd className="inline">
                  {detalle.contrato_id ? (
                    <Link href={`/contratos/${detalle.contrato_id}?tab=alertas-ia`} className="font-semibold text-blue-600 hover:text-blue-800">
                      Ver contrato
                    </Link>
                  ) : "General"}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
              {!detalle.leida && (
                <button
                  onClick={() => marcarLeida(detalle)}
                  disabled={guardando}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50"
                >
                  Marcar como leída
                </button>
              )}
              {!detalle.resuelta && detalle.estado !== "en_progreso" && (
                <button
                  onClick={() => cambiar(detalle, { estado: "en_progreso" })}
                  disabled={guardando}
                  className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg disabled:opacity-50"
                >
                  En progreso
                </button>
              )}
              {detalle.resuelta ? (
                <button
                  onClick={() => cambiar(detalle, { resuelta: false })}
                  disabled={guardando}
                  className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg disabled:opacity-50"
                >
                  Reabrir alerta
                </button>
              ) : (
                <button
                  onClick={() => cambiar(detalle, { resuelta: true })}
                  disabled={guardando}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : "Marcar como resuelta"}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
