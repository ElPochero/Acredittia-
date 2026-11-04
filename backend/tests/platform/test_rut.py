"""Formatos flexibles de RUT, Módulo 11 y unicidad por empresa (Día 2, Slice 1).

El validador debe aceptar tres escrituras del mismo RUT —`19.112.466-K`,
`19112466-K` y `19112466K`— normalizarlas a un formato canónico y guardar ya
normalizado, para que la unicidad activa por (empresa, contrato) no se burle
variando los puntos. El buscador por RUT debe encontrar por prefijo con o sin
separadores.

Convención del formato sin separadores: 8 caracteres = cuerpo de 7 + DV;
9 caracteres = cuerpo de 8 + DV.
"""
import pytest

from app.security import normalizar_rut, validar_rut

API = "/api/v1"


def _dv(cuerpo: str) -> str:
    suma, factor = 0, 2
    for c in reversed(cuerpo):
        suma += int(c) * factor
        factor = 2 if factor == 7 else factor + 1
    resto = 11 - (suma % 11)
    return "0" if resto == 11 else "K" if resto == 10 else str(resto)


def _canonico(cuerpo: str) -> str:
    return f"{cuerpo[:-6]}.{cuerpo[-6:-3]}.{cuerpo[-3:]}-{_dv(cuerpo)}"


# ------------------------------------------------------------------- módulo 11
def test_digito_verificador_K():
    cuerpo = next(f"{n:08d}" for n in range(1_000_000, 2_000_000)
                  if _dv(f"{n:08d}") == "K")
    assert validar_rut(f"{cuerpo[0:2]}.{cuerpo[2:5]}.{cuerpo[5:8]}-K") is True


def test_k_minuscula_sin_guion_se_normaliza_a_K():
    cuerpo = next(str(n) for n in range(7_000_000, 7_100_000)
                  if _dv(str(n)) == "K")
    assert normalizar_rut(f"{cuerpo}{_dv(cuerpo).lower()}") == _canonico(cuerpo)


# --------------------------------------------------------------------- formatos
@pytest.mark.parametrize("entrada", ["19.112.466-9", "19112466-9", "191124669"])
def test_los_tres_formatos_son_el_mismo_rut(entrada):
    assert validar_rut(entrada) is True
    assert normalizar_rut(entrada) == "19.112.466-9"


def test_ocho_digitos_sin_guion_es_cuerpo_de_siete_mas_dv():
    # 1911246-6 en una sola pieza: el DV es el último dígito.
    cuerpo = "1911246"
    assert normalizar_rut(f"{cuerpo}{_dv(cuerpo)}") == _canonico(cuerpo)


@pytest.mark.parametrize("entrada", [
    "12.345.678-0",   # dígito verificador incorrecto
    "19.112.466",     # falta el DV
    "1911246",        # solo 7 caracteres sin guión (cuerpo sobra por el DV)
    "19.112.44",      # no alcanza a ser cuerpo + DV
    "abc",            # no es un RUT
    "",               # vacío
    "  ",             # espacios
])
def test_formatos_invalidos(entrada):
    assert normalizar_rut(entrada) is None
    assert validar_rut(entrada) is False


def test_espacios_se_toleran():
    assert normalizar_rut(" 19.112.466-9 ") == "19.112.466-9"


# ------------------------------------------------------------------------- API
def test_alta_acepta_formatos_flexibles_y_guarda_normalizado(app_cliente,
                                                             empresa_a,
                                                             contrato_a):
    r = app_cliente.post(f"{API}/personal", headers=empresa_a["headers"], json={
        "contrato_id": contrato_a["id"], "nombre": "Ana Torres",
        "rut": "19112466-9"})
    assert r.status_code == 201, r.text
    assert r.json()["rut"] == "19.112.466-9"


def test_duplicado_detectado_entre_formatos(app_cliente, empresa_a, contrato_a):
    cuerpo = {"contrato_id": contrato_a["id"], "nombre": "Ana Torres",
              "rut": "19.112.466-9"}
    assert app_cliente.post(f"{API}/personal", headers=empresa_a["headers"],
                            json=cuerpo).status_code == 201

    for variante in ("19112466-9", "191124669"):
        r = app_cliente.post(f"{API}/personal", headers=empresa_a["headers"],
                             json={**cuerpo, "rut": variante})
        assert r.status_code == 409, variante
        assert r.json()["error"]["code"] == "RUT_DUPLICADO"


def test_rut_con_dv_invalido_rechazado(app_cliente, empresa_a, contrato_a):
    r = app_cliente.post(f"{API}/personal", headers=empresa_a["headers"],
                         json={"contrato_id": contrato_a["id"],
                               "nombre": "Ana", "rut": "19112466-0"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "RUT_INVALIDO"


def test_buscador_encuentra_por_prefijo_con_o_sin_puntos(app_cliente, empresa_a,
                                                        contrato_a):
    rut = "19.112.466-9"
    sid = app_cliente.post(f"{API}/personal", headers=empresa_a["headers"], json={
        "contrato_id": contrato_a["id"], "nombre": "Ana Torres",
        "rut": rut}).json()["id"]

    for busqueda in ("1911246", "19.112.4", "191124669"):
        r = app_cliente.get(f"{API}/personal", headers=empresa_a["headers"],
                            params={"search": busqueda,
                                    "contrato_id": contrato_a["id"]})
        ids = [x["id"] for x in r.json()["items"]]
        assert sid in ids, busqueda
