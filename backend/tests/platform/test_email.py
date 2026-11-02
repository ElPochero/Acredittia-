"""Renderizado de las plantillas de correo: layout, escape y CTA.

No tocan la base de datos: las plantillas son funciones puras y lo que se
prueba aquí es exactamente lo que se encola como `html_body`.
"""

from datetime import date

import pytest

from app.config import settings
from app.services import email as svc

BASE = {
    "empresa": "Transportes Alfa SpA",
    "contrato": "Contrato Mina",
    "faena": "Los Pelambres",
    "mandante": "AMSA",
}

# Las plantillas puntuales no llevan mandante: solo el estado semanal lo usa.
BASE_TPL = {k: BASE[k] for k in ("empresa", "contrato", "faena")}

DOC = {
    "titulo": "Certificado de Salud",
    "quien": "Trabajador · Juan Pérez",
    "vence": date(2026, 11, 15),
    "dias": 20,
    "estado": "porvenc",
}


def _resumen():
    return svc.correo_resumen(
        empresa=BASE["empresa"],
        contratos=[{
            "nombre": BASE["contrato"],
            "faena": BASE["faena"],
            "vencidos": [{**DOC, "estado": "venc", "dias": -4}],
            "porvencer": [DOC],
        }],
        periodo="octubre de 2026",
        url=f"{settings.app_url}/contratos/1",
    )


def _porvencer():
    return svc.correo_porvencer(
        **BASE_TPL, documento=DOC["titulo"], quien=DOC["quien"],
        vence=DOC["vence"], dias=DOC["dias"], estado=DOC["estado"],
        url=f"{settings.app_url}/contratos/1",
    )


def _observado():
    return svc.correo_observado(
        **BASE_TPL,
        documento=DOC["titulo"],
        quien=DOC["quien"],
        archivo="certificado.jpg",
        hallazgos=[
            "Documento ilegible: la imagen está borrosa.",
            "No se pudo verificar la vigencia del examen.",
        ],
        url=f"{settings.app_url}/contratos/1",
    )


RENDERS = {
    "resumen": _resumen,
    "porvencer": _porvencer,
    "observado": _observado,
}


@pytest.mark.parametrize("plantilla", list(RENDERS))
def test_plantilla_devuelve_asunto_html_y_texto(plantilla):
    asunto, html, texto = RENDERS[plantilla]()
    assert asunto.strip()
    assert texto.strip()
    assert "<html" in html and "</html>" in html
    assert "width:600px" in html and "max-width:100%" in html
    assert "display:none" in html, "preheader oculto"
    assert "flex" not in html and "grid" not in html
    assert "<table" in html
    assert settings.app_url in html, "CTA absoluto desde settings"
    assert "&lt;" not in asunto


@pytest.mark.parametrize("plantilla", list(RENDERS))
def test_escapa_datos_dinamicos(plantilla):
    malicioso = '<script>alert("xss")</script>'
    if plantilla == "resumen":
        _, html, _ = svc.correo_resumen(
            empresa=malicioso,
            contratos=[{
                "nombre": malicioso,
                "faena": malicioso,
                "vencidos": [],
                "porvencer": [{**DOC, "titulo": malicioso, "quien": malicioso}],
            }],
            periodo=malicioso,
            url=f"{settings.app_url}/contratos/1",
        )
    elif plantilla == "porvencer":
        _, html, _ = svc.correo_porvencer(
            **BASE_TPL, documento=malicioso, quien=malicioso,
            vence=DOC["vence"], dias=DOC["dias"],
            url=f"{settings.app_url}/contratos/1",
        )
    else:
        _, html, _ = svc.correo_observado(
            **BASE_TPL, documento=malicioso, quien=malicioso, archivo=malicioso,
            hallazgos=[malicioso], url=f"{settings.app_url}/contratos/1",
        )

    assert "<script>" not in html
    assert "&lt;script&gt;" in html


def test_fechas_en_formato_chileno():
    _, html, texto = _porvencer()
    assert "15/11/2026" in html
    assert "15/11/2026" in texto
    assert "2026-11-15" not in html


def test_porvencer_incluye_dias_restantes_y_pasos():
    asunto, html, _ = _porvencer()
    assert "20 días" in asunto
    assert "20 días" in html
    assert "Qué hacer" in html
    assert "Subir documento renovado" in html


def test_observado_lista_hallazgos_y_whatsapp():
    _, html, _ = _observado()
    assert "imagen está borrosa" in html
    assert "WhatsApp" in html
    assert "Revisar documento" in html


def test_resumen_agrupa_por_contrato_y_muestra_conteos():
    asunto, html, _ = _resumen()
    assert "2 vencimientos" in asunto
    assert "Contrato Mina" in html
    assert "1 vencido" in html
    assert "1 por vencer" in html
