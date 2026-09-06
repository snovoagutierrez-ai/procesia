"""Autenticacion y aislamiento entre cuentas.

Es la superficie mas sensible: un fallo aqui expone los procesos de una empresa
a otra. Cubre /auth/* y comprueba que cada recurso con dueno filtre por usuario.
"""


def test_registro_devuelve_el_usuario_sin_la_contrasena(client):
    res = client.post("/auth/register", json={"email": "ana@example.com", "password": "ClaveDePrueba123"})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["email"] == "ana@example.com"
    assert "password" not in body and "hashed_password" not in body


def test_no_se_puede_registrar_dos_veces_el_mismo_correo(client):
    client.post("/auth/register", json={"email": "ana@example.com", "password": "ClaveDePrueba123"})
    res = client.post("/auth/register", json={"email": "ana@example.com", "password": "OtraClave456"})
    assert res.status_code == 400


def test_login_con_contrasena_incorrecta_no_entrega_sesion(client):
    client.post("/auth/register", json={"email": "ana@example.com", "password": "ClaveDePrueba123"})
    res = client.post("/auth/login", data={"username": "ana@example.com", "password": "equivocada"})
    assert res.status_code == 401
    assert "access_token" not in res.cookies


def test_login_deja_la_cookie_httponly(client):
    client.post("/auth/register", json={"email": "ana@example.com", "password": "ClaveDePrueba123"})
    res = client.post("/auth/login", data={"username": "ana@example.com", "password": "ClaveDePrueba123"})
    assert res.status_code == 200
    cookie_header = res.headers.get("set-cookie", "")
    assert "access_token" in cookie_header
    # Sin HttpOnly, cualquier script de la pagina podria robar la sesion.
    assert "HttpOnly" in cookie_header


def test_sin_sesion_los_endpoints_privados_responden_401(client):
    for path in ("/auth/me", "/processes", "/macroprocesses", "/roles", "/systems"):
        assert client.get(path).status_code == 401, path


def test_logout_invalida_la_sesion(auth_client):
    assert auth_client.get("/auth/me").status_code == 200
    assert auth_client.post("/auth/logout").status_code == 200
    assert auth_client.get("/auth/me").status_code == 401


# --------------------------------------------------------------------------
# Aislamiento entre cuentas
# --------------------------------------------------------------------------

def test_un_usuario_no_ve_los_procesos_de_otro(client):
    client.post("/auth/register", json={"email": "a@example.com", "password": "ClaveDePrueba123"})
    client.post("/auth/login", data={"username": "a@example.com", "password": "ClaveDePrueba123"})
    macro = client.post("/macroprocesses", json={"code": "M-A", "name": "De A"}).json()
    proc_a = client.post("/processes", json={
        "macroprocess_id": macro["id"], "code": "P-A", "name": "Proceso de A"
    }).json()
    client.post("/auth/logout")

    client.post("/auth/register", json={"email": "b@example.com", "password": "ClaveDePrueba123"})
    client.post("/auth/login", data={"username": "b@example.com", "password": "ClaveDePrueba123"})

    assert client.get("/processes").json() == []
    assert client.get("/macroprocesses").json() == []
    # Y tampoco por id directo.
    assert client.get(f"/processes/{proc_a['id']}").status_code in (403, 404)


def test_un_usuario_no_puede_borrar_el_proceso_de_otro(client):
    client.post("/auth/register", json={"email": "a@example.com", "password": "ClaveDePrueba123"})
    client.post("/auth/login", data={"username": "a@example.com", "password": "ClaveDePrueba123"})
    macro = client.post("/macroprocesses", json={"code": "M-A", "name": "De A"}).json()
    proc_a = client.post("/processes", json={
        "macroprocess_id": macro["id"], "code": "P-A", "name": "Proceso de A"
    }).json()
    client.post("/auth/logout")

    client.post("/auth/register", json={"email": "b@example.com", "password": "ClaveDePrueba123"})
    client.post("/auth/login", data={"username": "b@example.com", "password": "ClaveDePrueba123"})
    assert client.delete(f"/processes/{proc_a['id']}").status_code in (403, 404)

    # El proceso sigue existiendo para su dueno.
    client.post("/auth/logout")
    client.post("/auth/login", data={"username": "a@example.com", "password": "ClaveDePrueba123"})
    assert client.get(f"/processes/{proc_a['id']}").status_code == 200


def test_los_roles_no_se_comparten_entre_cuentas(client):
    """Regresion: `roles` no tenia dueno y todas las empresas veian el
    cost_per_hour de las demas."""
    client.post("/auth/register", json={"email": "a@example.com", "password": "ClaveDePrueba123"})
    client.post("/auth/login", data={"username": "a@example.com", "password": "ClaveDePrueba123"})
    rol = client.post("/roles", json={"name": "Analista", "area": "Riesgo", "cost_per_hour": 25000})
    assert rol.status_code == 201, rol.text
    rol_id = rol.json()["id"]
    client.post("/auth/logout")

    client.post("/auth/register", json={"email": "b@example.com", "password": "ClaveDePrueba123"})
    client.post("/auth/login", data={"username": "b@example.com", "password": "ClaveDePrueba123"})
    assert client.get("/roles").json() == []
    assert client.get(f"/roles/{rol_id}").status_code == 404


def test_los_sistemas_no_se_comparten_entre_cuentas(client):
    client.post("/auth/register", json={"email": "a@example.com", "password": "ClaveDePrueba123"})
    client.post("/auth/login", data={"username": "a@example.com", "password": "ClaveDePrueba123"})
    sistema = client.post("/systems", json={"name": "SAP", "system_type": "ERP"})
    assert sistema.status_code == 201, sistema.text
    client.post("/auth/logout")

    client.post("/auth/register", json={"email": "b@example.com", "password": "ClaveDePrueba123"})
    client.post("/auth/login", data={"username": "b@example.com", "password": "ClaveDePrueba123"})
    assert client.get("/systems").json() == []
