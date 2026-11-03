"use client";
import React, { useEffect, useRef, useState } from "react";
import { Modal, Spinner } from "@/components/shared/ui";
import { Contrato } from "@/lib/platform/tipos";
import * as Api from "@/lib/platform/cliente";

interface ReporteContratoModalProps {
  abierto: boolean;
  onCerrar: () => void;
  contrato: Contrato | null;
}

function esc(t: any): string {
  return String(t == null ? "" : t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatFecha(f: string | null | undefined): string {
  if (!f) return "—";
  try {
    const [y, m, d] = f.split("-");
    if (y && m && d) return `${d}/${m}/${y}`;
    return f;
  } catch {
    return f;
  }
}

function generarHtmlReporte(data: any): string {
  const c = data.contrato;
  const k = data.kpis;
  const s = data.secciones;

  const vigTxt = c.vigencia_sin
    ? `${formatFecha(c.fecha_inicio)} · Sin fecha de término`
    : `${formatFecha(c.fecha_inicio)} → ${formatFecha(c.fecha_termino)} · ${
        c.dias_restantes < 0
          ? `vencido hace ${-c.dias_restantes} días`
          : `${c.dias_restantes} días restantes`
      }`;

  const kpiBox = (n: any, l: string, col?: string) =>
    `<div class="kpi"><b style="color:${col || "#0F172A"}">${n}</b><span>${l}</span></div>`;

  const bar = (pct: number) =>
    `<div class="bar"><i style="width:${pct}%;background:${
      pct >= 70 ? "#16a34a" : pct >= 40 ? "#f59e0b" : "#ef4444"
    }"></i></div><small>${pct}%</small>`;

  const chip = (estado: string) => {
    const map: Record<string, [string, string, string]> = {
      acreditado: ["Acreditado", "#15803d", "#dcfce7"],
      ok: ["Vigente", "#15803d", "#dcfce7"],
      porvenc: ["Por vencer", "#b45309", "#fef3c7"],
      venc: ["Vencido", "#b91c1c", "#fee2e2"],
      vencido: ["Vencido", "#b91c1c", "#fee2e2"],
      enproceso: ["En proceso", "#b45309", "#fef3c7"],
      falta: ["Pendiente", "#475569", "#f1f5f9"],
      bloqueado: ["Bloqueado", "#475569", "#e2e8f0"],
    };
    const [label, color, bg] = map[estado] || [estado, "#334155", "#f1f5f9"];
    return `<span class="chip" style="background:${bg};color:${color}">${label}</span>`;
  };

  const estadoGeneral =
    k.pct_global >= 90
      ? ["Cumplido", "#15803d", "#dcfce7"]
      : k.pct_global >= 50
      ? ["En proceso", "#b45309", "#fef3c7"]
      : ["Pendiente", "#b91c1c", "#fee2e2"];

  const css = `
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0F172A; margin: 0; padding: 24px 28px; font-size: 11px; background: #fff; line-height: 1.4; }
    .hd { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #3D62F5; padding-bottom: 12px; margin-bottom: 14px; }
    .hd h1 { font-size: 18px; margin: 0 0 4px; color: #0F172A; }
    .hd .r { text-align: right; color: #64748B; font-size: 10px; line-height: 1.5; }
    h2 { font-size: 13px; margin: 20px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #E2E8F0; color: #1E3A8A; text-transform: uppercase; letter-spacing: .4px; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 14px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; margin: 10px 0 12px; }
    .meta div span { display: block; color: #64748B; font-size: 9px; text-transform: uppercase; letter-spacing: .3px; }
    .meta div b { font-size: 11px; color: #0F172A; }
    .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-bottom: 12px; }
    .kpi { border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px; text-align: center; background: #fff; }
    .kpi b { display: block; font-size: 17px; margin-bottom: 2px; }
    .kpi span { font-size: 9px; color: #64748B; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 4px; }
    th { background: #1E3A8A; color: #fff; text-align: left; padding: 5px 7px; font-weight: 600; font-size: 10px; }
    td { padding: 5px 7px; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
    tr:nth-child(even) td { background: #F8FAFC; }
    .chip { display: inline-block; padding: 2px 7px; border-radius: 8px; font-weight: 700; font-size: 9px; white-space: nowrap; }
    .mut { color: #64748B; font-size: 9px; margin-top: 1px; }
    .red { color: #b91c1c; font-weight: 600; }
    .green { color: #15803d; font-weight: 600; }
    .bar { display: inline-block; width: 50px; height: 5px; background: #E2E8F0; border-radius: 3px; overflow: hidden; vertical-align: middle; margin: 0 4px; }
    .bar i { display: block; height: 100%; }
    small { color: #64748B; font-size: 9px; }
    .empty { color: #94A3B8; font-style: italic; padding: 8px 0; font-size: 10px; }
    .st { display: flex; gap: 12px; flex-wrap: wrap; margin: 2px 0 6px; font-size: 10px; color: #475569; }
    .ft { margin-top: 22px; padding-top: 8px; border-top: 1px solid #E2E8F0; color: #94A3B8; font-size: 9px; display: flex; justify-content: space-between; }
    @page { size: A4; margin: 10mm; }
    @media print { body { padding: 0; } h2 { break-after: avoid; } tr { break-inside: avoid; } .hd { border-bottom-color: #3D62F5; } }
  `;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reporte ${esc(c.nombre)} — ACREDITTIA</title>
  <style>${css}</style>
</head>
<body>
  <div class="hd">
    <div>
      <div style="font-size: 16px; font-weight: 900; color: #0F172A; letter-spacing: -0.5px;">ACREDITTIA</div>
      <div style="margin-top: 8px">
        <h1>Reporte de estado del contrato</h1>
        <div style="font-size: 12px; color: #334155">
          <b>${esc(c.nombre)}</b> · ${esc(c.codigo || c.num)}
        </div>
      </div>
    </div>
    <div class="r">
      Emitido el ${esc(data.fecha)}<br>
      <b>${esc(data.empresa?.nombre || "Mi Empresa")}</b><br>
      <span class="chip" style="background:${estadoGeneral[2]};color:${estadoGeneral[1]};font-size:10px;margin-top:4px">
        Estado general: ${estadoGeneral[0]} · ${k.pct_global}%
      </span>
    </div>
  </div>

  <div class="meta">
    <div><span>N° contrato</span><b>${esc(c.num)}</b></div>
    <div><span>Faena</span><b>${esc(c.faena?.nombre || "—")}</b></div>
    <div><span>Mandante</span><b>${esc(c.mandante || "—")}</b></div>
    <div><span>Vigencia</span><b>${esc(vigTxt)}</b></div>
    <div><span>Estado del contrato</span><b>${esc(c.vigencia_estado)}</b></div>
    <div><span>Plataformas</span><b>${esc(c.plataformas)}</b></div>
  </div>

  <div class="kpis">
    ${kpiBox(`${k.pct_global}%`, "Cumplimiento global", k.pct_global >= 70 ? "#15803d" : k.pct_global >= 40 ? "#b45309" : "#b91c1c")}
    ${kpiBox(`${k.personal_acreditados}/${k.personal_total}`, "Personal acreditado")}
    ${kpiBox(`${k.equipos_acreditados}/${k.equipos_total}`, "Equipos acreditados")}
    ${kpiBox(`${k.licencias_acreditadas}/${k.licencias_total}`, "Licencias internas")}
    ${kpiBox(k.docs_vencidos, "Documentos vencidos", "#b91c1c")}
    ${kpiBox(k.docs_por_vencer, "Por vencer (30 días)", "#b45309")}
  </div>

  <h2>1. Empresa</h2>
  <div class="st">${k.empresa_ok} de ${k.empresa_total} documentos vigentes</div>
  ${
    s.empresa.length
      ? `<table>
          <thead>
            <tr><th>Documento</th><th>Tipo</th><th>Plataforma</th><th>Estado</th><th>Vencimiento</th></tr>
          </thead>
          <tbody>
            ${s.empresa.map((d: any) => `
              <tr>
                <td><b>${esc(d.titulo)}</b></td>
                <td>${d.obligatorio ? "Obligatorio" : "Opcional"}</td>
                <td>${esc(d.plataforma || "—")}</td>
                <td>${chip(d.estado)}</td>
                <td>${d.vence ? formatFecha(d.vence) : "—"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`
      : `<div class="empty">Sin requisitos de empresa.</div>`
  }

  <h2>2. Personal</h2>
  <div class="st">
    <span>Total: <b>${s.personal.length}</b></span>
    <span class="green">Acreditados: <b>${k.personal_acreditados}</b></span>
    <span class="red">Vencidos: <b>${s.personal.filter((p: any) => p.estado === "vencido").length}</b></span>
    <span>En proceso: <b>${s.personal.filter((p: any) => p.estado === "enproceso").length}</b></span>
  </div>
  ${
    s.personal.length
      ? `<table>
          <thead>
            <tr><th>Trabajador</th><th>Estado</th><th>Documentos</th><th>Vencidos</th><th>Pendientes</th><th>Próx. venc.</th></tr>
          </thead>
          <tbody>
            ${s.personal.map((p: any) => `
              <tr>
                <td><b>${esc(p.nombre)}</b><div class="mut">${esc(p.rut || "—")} · ${esc(p.cargo || "—")}</div></td>
                <td>${chip(p.estado)}</td>
                <td style="white-space:nowrap">${p.ok}/${p.total} ${bar(p.pct)}</td>
                <td>${p.vencidos.length ? `<span class="red">${p.vencidos.map(esc).join(", ")}</span>` : "—"}</td>
                <td>${p.faltantes.length ? esc(p.faltantes.join(", ")) : `<span class="green">Completo</span>`}</td>
                <td style="white-space:nowrap">${p.prox_vence ? formatFecha(p.prox_vence) : "—"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`
      : `<div class="empty">No hay trabajadores asignados a este contrato.</div>`
  }

  <h2>3. Equipos y vehículos</h2>
  <div class="st">
    <span>Total: <b>${s.equipos.length}</b></span>
    <span class="green">Acreditados: <b>${k.equipos_acreditados}</b></span>
    <span class="red">Vencidos: <b>${s.equipos.filter((e: any) => e.estado === "vencido").length}</b></span>
    <span>En proceso: <b>${s.equipos.filter((e: any) => e.estado === "enproceso").length}</b></span>
  </div>
  ${
    s.equipos.length
      ? `<table>
          <thead>
            <tr><th>Equipo</th><th>Estado</th><th>Documentos</th><th>Vencidos</th><th>Pendientes</th><th>Próx. venc.</th></tr>
          </thead>
          <tbody>
            ${s.equipos.map((e: any) => `
              <tr>
                <td><b>${esc(e.nombre)}</b><div class="mut">${esc(e.patente || "—")} · ${esc(e.tipo_equipo || "—")}</div></td>
                <td>${chip(e.estado)}</td>
                <td style="white-space:nowrap">${e.ok}/${e.total} ${bar(e.pct)}</td>
                <td>${e.vencidos.length ? `<span class="red">${e.vencidos.map(esc).join(", ")}</span>` : "—"}</td>
                <td>${e.faltantes.length ? esc(e.faltantes.join(", ")) : `<span class="green">Completo</span>`}</td>
                <td style="white-space:nowrap">${e.prox_vence ? formatFecha(e.prox_vence) : "—"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`
      : `<div class="empty">No hay equipos asignados a este contrato.</div>`
  }

  <h2>4. Licencia interna (conductores)</h2>
  ${
    s.licencias.length
      ? `<table>
          <thead>
            <tr><th>Conductor</th><th>Estado</th><th>Requisitos</th><th>N° LIM</th><th>Pendientes</th></tr>
          </thead>
          <tbody>
            ${s.licencias.map((l: any) => `
              <tr>
                <td><b>${esc(l.nombre)}</b><div class="mut">${esc(l.rut || "—")}</div></td>
                <td>${chip(l.estado)}</td>
                <td style="white-space:nowrap">${l.ok}/${l.total} ${bar(l.pct)}</td>
                <td>${esc(l.num_lim || "—")}</td>
                <td>${l.faltantes.length ? esc(l.faltantes.join(", ")) : `<span class="green">Completo</span>`}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`
      : `<div class="empty">No hay conductores con licencia interna en este contrato.</div>`
  }

  <h2>5. Carpeta de Arranque</h2>
  <div class="st">${k.arranque_ok} de ${k.arranque_total} documentos cargados</div>
  ${
    s.arranque.length
      ? `<table>
          <thead>
            <tr><th>Documento</th><th>Tipo</th><th>Estado</th><th>Vencimiento</th></tr>
          </thead>
          <tbody>
            ${s.arranque.map((a: any) => `
              <tr>
                <td><b>${esc(a.titulo)}</b></td>
                <td>${a.obligatorio ? "Obligatorio" : "Opcional"}</td>
                <td>${chip(a.estado)}</td>
                <td>${a.vence ? formatFecha(a.vence) : "—"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`
      : `<div class="empty">Sin documentos de arranque cargados.</div>`
  }

  <h2>6. Vencidos y próximos vencimientos</h2>
  ${
    s.vencimientos.length
      ? `<table>
          <thead>
            <tr><th>Documento</th><th>Corresponde a</th><th>Vencimiento</th><th>Situación</th></tr>
          </thead>
          <tbody>
            ${s.vencimientos.map((v: any) => `
              <tr>
                <td><b>${esc(v.documento)}</b></td>
                <td>${esc(v.corresponde_a)}</td>
                <td>${v.vence ? formatFecha(v.vence) : "—"}</td>
                <td>
                  ${
                    v.estado === "venc"
                      ? `<span class="chip" style="background:#fee2e2;color:#b91c1c">Vencido hace ${-v.dias} días</span>`
                      : `<span class="chip" style="background:#fef3c7;color:#b45309">Vence en ${v.dias} días</span>`
                  }
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>`
      : `<div class="empty">Sin documentos vencidos ni por vencer en los próximos 30 días.</div>`
  }

  <div class="ft">
    <span>Generado por ACREDITTIA · acreditación inteligente</span>
    <span>${esc(c.nombre)} · ${esc(data.fecha)}</span>
  </div>
</body>
</html>`;
}

function descargarExcel(data: any) {
  const c = data.contrato;
  const k = data.kpis;
  const s = data.secciones;

  const sheet = (name: string, cols: string[], rows: any[][]) =>
    `<Worksheet ss:Name="${esc(name).slice(0, 31)}"><Table>${[cols]
      .concat(rows)
      .map(
        (r, i) =>
          `<Row>${r
            .map(
              (v) =>
                `<Cell${i === 0 ? ' ss:StyleID="h"' : ""}><Data ss:Type="String">${esc(v)}</Data></Cell>`
            )
            .join("")}</Row>`
      )
      .join("")}</Table></Worksheet>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="h"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1E3A8A" ss:Pattern="Solid"/></Style></Styles>
${sheet("Resumen", ["Campo", "Valor"], [
  ["Contrato", c.nombre],
  ["Código", c.codigo || "—"],
  ["N° contrato", c.num],
  ["Faena", c.faena?.nombre || "—"],
  ["Mandante", c.mandante || "—"],
  [
    "Vigencia",
    c.vigencia_sin
      ? `${formatFecha(c.fecha_inicio)} · Sin término`
      : `${formatFecha(c.fecha_inicio)} → ${formatFecha(c.fecha_termino)}`,
  ],
  ["Días restantes", c.vigencia_sin ? "—" : String(c.dias_restantes ?? "")],
  ["Estado general", `${k.pct_global}%`],
  ["Trabajadores acreditados", `${k.personal_acreditados}/${k.personal_total}`],
  ["Equipos acreditados", `${k.equipos_acreditados}/${k.equipos_total}`],
  ["Licencias internas", `${k.licencias_acreditadas}/${k.licencias_total}`],
  ["Documentos vencidos", String(k.docs_vencidos)],
  ["Por vencer (30 días)", String(k.docs_por_vencer)],
  ["Emitido", data.fecha],
])}
${sheet(
  "Empresa",
  ["Documento", "Tipo", "Plataforma", "Estado", "Vencimiento"],
  s.empresa.map((d: any) => [
    d.titulo,
    d.obligatorio ? "Obligatorio" : "Opcional",
    d.plataforma || "—",
    d.estado === "ok"
      ? "Vigente"
      : d.estado === "porvenc"
      ? "Por vencer"
      : d.estado === "venc"
      ? "Vencido"
      : "Pendiente",
    d.vence ? formatFecha(d.vence) : "—",
  ])
)}
${sheet(
  "Personal",
  ["Nombre", "RUT", "Cargo", "Estado", "Documentos", "%", "Vencidos", "Pendientes", "Próx. vencimiento"],
  s.personal.map((p: any) => [
    p.nombre,
    p.rut || "—",
    p.cargo || "—",
    p.estado === "acreditado"
      ? "Acreditado"
      : p.estado === "vencido"
      ? "Vencido"
      : p.estado === "bloqueado"
      ? "Bloqueado"
      : "En proceso",
    `${p.ok}/${p.total}`,
    `${p.pct}%`,
    (p.vencidos || []).join(", "),
    (p.faltantes || []).join(", "),
    p.prox_vence ? formatFecha(p.prox_vence) : "—",
  ])
)}
${sheet(
  "Equipos",
  ["Equipo", "Patente", "Tipo", "Estado", "Documentos", "%", "Vencidos", "Pendientes", "Próx. vencimiento"],
  s.equipos.map((e: any) => [
    e.nombre,
    e.patente || "—",
    e.tipo_equipo || "—",
    e.estado === "acreditado"
      ? "Acreditado"
      : e.estado === "vencido"
      ? "Vencido"
      : e.estado === "bloqueado"
      ? "Bloqueado"
      : "En proceso",
    `${e.ok}/${e.total}`,
    `${e.pct}%`,
    (e.vencidos || []).join(", "),
    (e.faltantes || []).join(", "),
    e.prox_vence ? formatFecha(e.prox_vence) : "—",
  ])
)}
${sheet(
  "Licencia interna",
  ["Conductor", "RUT", "Estado", "Requisitos", "N° LIM", "Pendientes"],
  s.licencias.map((l: any) => [
    l.nombre,
    l.rut || "—",
    l.estado === "acreditado" ? "Acreditado" : l.estado === "vencido" ? "Vencido" : "En proceso",
    `${l.ok}/${l.total}`,
    l.num_lim || "—",
    (l.faltantes || []).join(", "),
  ])
)}
${sheet(
  "Carpeta de Arranque",
  ["Documento", "Tipo", "Estado", "Vencimiento"],
  s.arranque.map((a: any) => [
    a.titulo,
    a.obligatorio ? "Obligatorio" : "Opcional",
    a.estado === "ok"
      ? "Vigente"
      : a.estado === "porvenc"
      ? "Por vencer"
      : a.estado === "venc"
      ? "Vencido"
      : "Pendiente",
    a.vence ? formatFecha(a.vence) : "—",
  ])
)}
${sheet(
  "Vencimientos",
  ["Documento", "Corresponde a", "Vencimiento", "Situación"],
  s.vencimientos.map((v: any) => [
    v.documento,
    v.corresponde_a,
    v.vence ? formatFecha(v.vence) : "—",
    v.estado === "venc" ? `Vencido hace ${-v.dias} días` : `Vence en ${v.dias} días`,
  ])
)}
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Reporte ${c.nombre.replace(/[\\/:*?"<>|]/g, "-")} ${data.fecha.replace(/\//g, "-")}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function ReporteContratoModal({ abierto, onCerrar, contrato }: ReporteContratoModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporteData, setReporteData] = useState<any>(null);
  const [htmlReporte, setHtmlReporte] = useState<string>("");

  useEffect(() => {
    if (!abierto || !contrato) return;

    let cancelado = false;
    setCargando(true);
    setError(null);
    setHtmlReporte("");
    setReporteData(null);

    Api.contratos
      .reporteEstado(contrato.id)
      .then((data) => {
        if (cancelado) return;
        setReporteData(data);
        const html = generarHtmlReporte(data);
        setHtmlReporte(html);
      })
      .catch((err) => {
        if (cancelado) return;
        setError(Api.mensajeError(err));
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [abierto, contrato]);

  if (!contrato) return null;

  const cerrar = () => {
    setError(null);
    onCerrar();
  };

  const handleImprimirPdf = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    } else if (htmlReporte) {
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(htmlReporte);
        w.document.close();
        setTimeout(() => w.print(), 300);
      }
    }
  };

  const handleDescargarExcel = () => {
    if (!reporteData) return;
    descargarExcel(reporteData);
  };

  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo="" ancho="max-w-[1000px]">
      <div className="flex items-center justify-between gap-4 mb-3 pb-3 border-b border-slate-200 flex-wrap">
        <div>
          <h3 className="m-0 text-base font-bold text-slate-900">
            Reporte de estado — {contrato.nombre}
          </h3>
          <p className="m-0 text-xs text-slate-500 mt-0.5">
            Empresa, personal, equipos, licencia interna, carpeta de arranque y vencimientos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDescargarExcel}
            disabled={cargando || !reporteData}
            className="px-3.5 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
          >
            📊 Descargar Excel
          </button>
          <button
            onClick={handleImprimirPdf}
            disabled={cargando || !htmlReporte}
            className="px-3.5 py-1.5 bg-[#3D62F5] text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
          >
            🖨️ Descargar PDF
          </button>
          <button
            onClick={cerrar}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            ✕ Cerrar
          </button>
        </div>
      </div>

      {cargando && (
        <div className="h-[65vh] flex flex-col items-center justify-center gap-3 bg-slate-50 border border-slate-200 rounded-xl">
          <Spinner texto="Generando vista previa del reporte de estado…" />
        </div>
      )}

      {error && !cargando && (
        <div className="h-[65vh] flex flex-col items-center justify-center p-6 bg-red-50 border border-red-200 rounded-xl text-center">
          <span className="text-2xl mb-2" aria-hidden="true">⚠️</span>
          <p className="text-sm font-bold text-red-800 mb-1">Error al generar reporte</p>
          <p className="text-xs text-red-600 mb-4">{error}</p>
          <button
            onClick={cerrar}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700"
          >
            Cerrar
          </button>
        </div>
      )}

      {!cargando && !error && htmlReporte && (
        <iframe
          ref={iframeRef}
          srcDoc={htmlReporte}
          title={`Reporte de estado — ${contrato.nombre}`}
          className="w-full h-[70vh] border border-slate-200 rounded-lg bg-white shadow-inner"
        />
      )}
    </Modal>
  );
}
