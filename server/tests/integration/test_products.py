def test_create_product_with_attributes(client, auth_headers):
    resp = client.post("/products", json={
        "name": "Capot moteur",
        "reference": "PROD-001",
        "client": "Renault",
        "cheatsheet": "Vérifier les coulures et le givrage.",
    }, headers=auth_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["reference"] == "PROD-001"
    assert body["client"] == "Renault"
    assert body["cheatsheet"].startswith("Vérifier")


def test_update_product_attributes(client, auth_headers):
    pid = client.post("/products", json={"name": "X"}, headers=auth_headers).json()["id"]
    resp = client.patch(
        f"/products/{pid}",
        json={"client": "Peugeot", "reference": "R9", "cheatsheet": "Notes"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["client"] == "Peugeot"
    assert body["reference"] == "R9"
    assert body["cheatsheet"] == "Notes"


def test_create_product_without_attributes_is_fine(client, auth_headers):
    resp = client.post("/products", json={"name": "Sans attributs"}, headers=auth_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["reference"] is None and body["client"] is None
