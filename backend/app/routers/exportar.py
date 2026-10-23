"""Exportación documental en ZIP por plataforma de destino (H-20, H-29).

Un único constructor (`_plan`) alimenta la vista previa (`GET /exportar/arbol`) y
la descarga (`GET /exportar/zip`): lo que el usuario ve antes de confirmar es
exactamente lo que recibe. La plataforma elegida solo nombra el archivo raíz
(`CT-XXX_SIGA.zip`); no filtra documentos: únicamente las plantillas EMSIPOR
llevan `plataforma`, así que filtrar por ella dejaría vacía la exportación de
Personal y Equipos.

Estructuras por sección (`estructura=empresa:sueltos,personal:carpetas,...`):

* `sueltos`  — los archivos van directo a la carpeta de la sección.
* `carpetas` — una carpeta por ficha (documento de empresa, trabajador o equipo).
* `pdf`      — un PDF unido por ficha. Si la unión falla o la ficha no tiene
  PDFs, se degrada a los archivos originales dentro de su carpeta.
"""
from __future__ import annotations

import io
import logging
import re
import tempfile
import unicodedata
import uuid
import zipfile

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..deps import (contrato_scope, err, get_company_id, get_current_user,
                    get_db, require_contrato)
from ..models import Contrato, Documento, DocumentoArchivo, Sujeto, User
from ..services.storage import get_storage

logger = logging.getLogger("acredittia.exportar")

router = APIRouter(prefix="/exportar", tags=["exportar"])

SECCIONES: dict[str, str] = {
    "empresa": "Empresa",
    "personal": "Personal",
    "equipos": "Equipos",
    "licencia": "Licencia Interna",
}
SECCION_DIR = {
    "empresa": "01_Empresa",
    "personal": "02_Personal",
    "equipos": "03_Equipos",
    "licencia": "04_Licencia_Interna",
}
MODOS = ("sueltos", "carpetas", "pdf")
PLATAFORMAS = ("SIGA", "DIRECTIC", "SGES", "Academia MLP", "EMSIPOR")


# --------------------------------------------------------------------- utilidades
def _limpio(texto: str | None, limite: int = 90) -> str:
    """Nombre seguro para ZIP: sin tildes ni caracteres reservados."""
    t = unicodedata.normalize("NFKD", texto or "")
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r'[\\/:*?"<>|]+', "-", t).strip(" .")
    return t[:limite] or "sin-nombre"


def _codigo(contrato: Contrato | None) -> str:
    if contrato is None:
        return "EMPRESA"
    return contrato.codigo or f"CT-{str(contrato.id)[:8].upper()}"


def _nombre_zip(contrato: Contrato | None, plataforma: str) -> str:
    return f"{_codigo(contrato)}_{_limpio(plataforma, 40).replace(' ', '-')}.zip"


def _parse_incluir(valor: str | None) -> list[str]:
    claves = [p.strip() for p in (valor or "").split(",") if p.strip()]
    if not claves:
        return ["empresa", "personal", "equipos"]
    invalidas = [c for c in claves if c not in SECCIONES]
    if invalidas:
        raise err(400, "SECCION_INVALIDA",
                  f"Secciones válidas: {', '.join(SECCIONES)}")
    return [c for c in SECCIONES if c in claves]      # orden fijo del árbol


def _parse_estructura(valor: str | None) -> dict[str, str]:
    modos = {k: "carpetas" for k in SECCIONES}
    for parte in (valor or "").split(","):
        if not parte.strip():
            continue
        clave, _, modo = parte.partition(":")
        clave, modo = clave.strip(), (modo or "carpetas").strip()
        if clave not in SECCIONES or modo not in MODOS:
            raise err(400, "ESTRUCTURA_INVALIDA",
                      f"Use 'seccion:modo' con modo en {', '.join(MODOS)}")
        modos[clave] = modo
    return modos


def _contrato(db: Session, cid: uuid.UUID, contrato_id: uuid.UUID | None,
              user: User) -> Contrato | None:
    """Contrato efectivo: el pedido o el del usuario acotado (§3.3)."""
    efectivo = contrato_id or contrato_scope(user)
    if efectivo is None:
        return None
    if contrato_id:
        require_contrato(contrato_id, user)
    c = db.get(Contrato, efectivo)
    if c is None or c.company_id != cid:
        raise err(404, "NO_ENCONTRADO", "Contrato no existe")
    return c


def _es_pdf(a: DocumentoArchivo) -> bool:
    return (a.content_type or "").lower() == "application/pdf" \
        or (a.filename or "").lower().endswith(".pdf")


def _archivos(db: Session, cid: uuid.UUID,
              ids: list[uuid.UUID]) -> dict[uuid.UUID, list[DocumentoArchivo]]:
    salida: dict[uuid.UUID, list[DocumentoArchivo]] = {}
    if not ids:
        return salida
    for a in db.scalars(select(DocumentoArchivo).where(
            DocumentoArchivo.company_id == cid,
            DocumentoArchivo.documento_id.in_(ids)).order_by(
                DocumentoArchivo.created_at)):
        salida.setdefault(a.documento_id, []).append(a)
    return salida


def _sujetos(db: Session, cid: uuid.UUID, contrato: Contrato | None,
             tipo: str) -> list[Sujeto]:
    q = select(Sujeto).where(Sujeto.company_id == cid, Sujeto.tipo == tipo)
    if contrato is not None:
        q = q.where(Sujeto.contrato_id == contrato.id)
    return list(db.scalars(q.order_by(Sujeto.nombre)))


def _docs_sujetos(db: Session, cid: uuid.UUID,
                  ids: list[uuid.UUID]) -> dict[uuid.UUID, list[Documento]]:
    salida: dict[uuid.UUID, list[Documento]] = {}
    if not ids:
        return salida
    for d in db.scalars(select(Documento).where(
            Documento.company_id == cid,
            Documento.sujeto_id.in_(ids)).order_by(Documento.titulo)):
        salida.setdefault(d.sujeto_id, []).append(d)
    return salida


def _nombre_grupo(s: Sujeto) -> str:
    return _limpio(" ".join(p for p in (s.rut or s.patente, s.nombre) if p), 80)


def _unico(ruta: str, usadas: set[str]) -> str:
    if ruta not in usadas:
        usadas.add(ruta)
        return ruta
    base, punto, ext = ruta.rpartition(".")
    i = 2
    while True:
        cand = f"{base} ({i}).{ext}" if punto else f"{ruta} ({i})"
        if cand not in usadas:
            usadas.add(cand)
            return cand
        i += 1


def _carpetas(rutas: list[str]) -> set[str]:
    carpetas: set[str] = set()
    for ruta in rutas:
        partes = ruta.split("/")[:-1]
        for i in range(1, len(partes) + 1):
            carpetas.add("/".join(partes[:i]))
    return carpetas


# ------------------------------------------------------------------- plan
def _plan(db: Session, cid: uuid.UUID, contrato: Contrato | None,
          incluir: list[str], modos: dict[str, str], solo_vigentes: bool
          ) -> tuple[list[dict], dict]:
    """Entradas del ZIP + contadores de lo que quedó fuera.

    Cada entrada es `{seccion, ruta, archivos, unir}`: `unir=True` significa que
    los `archivos` (blob_paths) se fusionan en un PDF antes de escribirse.
    """
    grupos: list[tuple[str, str, list[Documento]]] = []
    vencidos = 0

    def agregar(clave: str, grupo: str, docs: list[Documento]) -> None:
        nonlocal vencidos
        if solo_vigentes:
            antes = len(docs)
            docs = [d for d in docs if d.estado_calc != "venc"]
            vencidos += antes - len(docs)
        if docs:
            grupos.append((clave, grupo, docs))

    if "empresa" in incluir:
        q = select(Documento).where(Documento.company_id == cid,
                                    Documento.sujeto_id.is_(None))
        if contrato is not None:
            q = q.where(Documento.contrato_id == contrato.id)
        for d in db.scalars(q.order_by(Documento.titulo)):
            agregar("empresa", _limpio(d.titulo), [d])

    needs_workers = "personal" in incluir or "licencia" in incluir
    needs_equipos = "equipos" in incluir
    sujetos_worker = _sujetos(db, cid, contrato, "trabajador") \
        if needs_workers else []
    sujetos_equipo = _sujetos(db, cid, contrato, "equipo") \
        if needs_equipos else []
    docs_sujeto = _docs_sujetos(
        db, cid, [s.id for s in sujetos_worker + sujetos_equipo])

    if needs_workers:
        for s in sujetos_worker:
            if "personal" in incluir:
                agregar("personal", _nombre_grupo(s),
                        [d for d in docs_sujeto.get(s.id, []) if not d.es_emsipor])
            if "licencia" in incluir:
                agregar("licencia", _nombre_grupo(s),
                        [d for d in docs_sujeto.get(s.id, []) if d.es_emsipor])
    if needs_equipos:
        for s in sujetos_equipo:
            agregar("equipos", _nombre_grupo(s), docs_sujeto.get(s.id, []))

    bienes = _archivos(db, cid, [d.id for _, _, docs in grupos for d in docs])
    storage = get_storage()
    plan: list[dict] = []
    usadas: set[str] = set()
    sin_archivo = 0

    for clave, grupo, docs in grupos:
        # La vista previa promete lo que el ZIP entrega: se descartan los blobs
        # que ya no existen en el almacenamiento.
        archivos = [a for d in docs for a in bienes.get(d.id, [])
                    if storage.exists(a.blob_path)]
        if not archivos:
            sin_archivo += 1
            continue
        directorio = SECCION_DIR[clave]
        modo = modos[clave]

        if modo == "pdf":
            pdfs = [a for a in archivos if _es_pdf(a)]
            if pdfs:
                plan.append({
                    "seccion": clave, "unir": True,
                    "ruta": _unico(f"{directorio}/{grupo}.pdf", usadas),
                    "archivos": [a.blob_path for a in pdfs],
                })
            for a in archivos:
                if a in pdfs:
                    continue
                plan.append({
                    "seccion": clave, "unir": False,
                    "ruta": _unico(
                        f"{directorio}/{grupo}/{_limpio(a.filename)}", usadas),
                    "archivos": [a.blob_path],
                })
            continue

        for a in archivos:
            nombre = _limpio(a.filename)
            if modo == "sueltos":
                prefijo = "" if clave == "empresa" else f"{grupo}__"
                ruta = f"{directorio}/{prefijo}{nombre}"
            else:
                ruta = f"{directorio}/{grupo}/{nombre}"
            plan.append({"seccion": clave, "unir": False,
                         "ruta": _unico(ruta, usadas),
                         "archivos": [a.blob_path]})

    return plan, {"vencidos": vencidos, "sin_archivo": sin_archivo}


# ---------------------------------------------------------------- ZIP/PDF
def _unir_pdfs(datos: list[bytes]) -> bytes | None:
    """Une PDFs con PyMuPDF; `None` si alguno no es un PDF válido."""
    if not datos:
        return None
    try:
        import fitz

        salida = fitz.open()
        try:
            for d in datos:
                with fitz.open(stream=d, filetype="pdf") as doc:
                    salida.insert_pdf(doc)
            return salida.tobytes()
        finally:
            salida.close()
    except Exception as e:      # PDF corrupto o pymupdf ausente
        logger.warning("no se pudo unir PDF (%s); se envían archivos sueltos",
                       type(e).__name__)
        return None


def _escribir_zip(plan: list[dict]) -> tempfile.SpooledTemporaryFile:
    """Escribe el ZIP en un archivo temporal (disco si crece) y lo rebobina."""
    storage = get_storage()
    buf = tempfile.SpooledTemporaryFile(max_size=32 * 1024 * 1024)
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for entrada in plan:
            datos: list[bytes] = []
            for blob in entrada["archivos"]:
                try:
                    datos.append(storage.read(blob))
                except Exception:
                    logger.warning("blob ausente al exportar: %s", blob)
            if not datos:
                continue
            if entrada["unir"]:
                pdf = _unir_pdfs(datos)
                if pdf is not None:
                    z.writestr(entrada["ruta"], pdf)
                    continue
                # Sin unión posible: se conserva la evidencia, separada.
                base = entrada["ruta"][:-4] if entrada["ruta"].endswith(".pdf") \
                    else entrada["ruta"]
                for i, d in enumerate(datos, start=1):
                    z.writestr(f"{base}-{i}.pdf", d)
                continue
            z.writestr(entrada["ruta"], datos[0])
    buf.seek(0)
    return buf


def _stream(buf: tempfile.SpooledTemporaryFile):
    try:
        while True:
            chunk = buf.read(1024 * 1024)
            if not chunk:
                break
            yield chunk
    finally:
        buf.close()


# ------------------------------------------------------------------ endpoints
@router.get("/arbol")
def arbol(contrato_id: uuid.UUID | None = Query(None),
          plataforma: str = Query("SIGA"),
          incluir: str | None = Query(None),
          estructura: str | None = Query(None),
          solo_vigentes: bool = Query(True),
          db: Session = Depends(get_db),
          cid: uuid.UUID = Depends(get_company_id),
          user: User = Depends(get_current_user)):
    """Árbol y contadores de la exportación, sin leer los archivos."""
    contrato = _contrato(db, cid, contrato_id, user)
    secciones = _parse_incluir(incluir)
    plan, excluidos = _plan(db, cid, contrato, secciones,
                            _parse_estructura(estructura), solo_vigentes)
    rutas = [e["ruta"] for e in plan]
    return {
        "nombre_zip": _nombre_zip(contrato, plataforma),
        "plataforma": plataforma,
        "total_archivos": len(plan),
        "total_carpetas": len(_carpetas(rutas)),
        "secciones": [{"clave": k, "titulo": SECCIONES[k],
                       "archivos": sum(1 for e in plan if e["seccion"] == k)}
                      for k in secciones],
        "rutas": rutas[:300],
        "truncado": len(rutas) > 300,
        "excluidos": excluidos,
    }


@router.get("/zip")
def zip_documentos(contrato_id: uuid.UUID | None = Query(None),
                   plataforma: str = Query("SIGA"),
                   incluir: str | None = Query(None),
                   estructura: str | None = Query(None),
                   solo_vigentes: bool = Query(True),
                   db: Session = Depends(get_db),
                   cid: uuid.UUID = Depends(get_company_id),
                   user: User = Depends(get_current_user)):
    """Descarga el ZIP con las secciones, carpetas y PDFs pedidos."""
    contrato = _contrato(db, cid, contrato_id, user)
    secciones = _parse_incluir(incluir)
    plan, _ = _plan(db, cid, contrato, secciones,
                    _parse_estructura(estructura), solo_vigentes)
    if not plan:
        raise err(404, "SIN_DOCUMENTOS",
                  "No hay documentos con archivos para los filtros elegidos")
    nombre = _nombre_zip(contrato, plataforma)
    buf = _escribir_zip(plan)
    return StreamingResponse(
        _stream(buf), media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )
