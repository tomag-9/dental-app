def test_clinics_and_price_list_crud(client, auth_headers):
    # create clinic
    c_payload = {"name": "New Clinic", "address": "1 Test Rd"}
    resp = client.post("/clinics/", headers=auth_headers, json=c_payload)
    assert resp.status_code == 200
    clinic = resp.json()
    cid = clinic["id"]

    # get clinic
    resp = client.get(f"/clinics/{cid}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Clinic"

    # update clinic
    resp = client.put(f"/clinics/{cid}", headers=auth_headers, json={"name": "Updated Clinic", "address": "1 Test Rd"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Clinic"

    # delete
    resp = client.delete(f"/clinics/{cid}", headers=auth_headers)
    assert resp.status_code == 200

    # price list CRUD
    pl_payload = {"code": "PL123", "description": "Test item", "price": 12.5}
    resp = client.post("/price_list/", headers=auth_headers, json=pl_payload)
    assert resp.status_code == 200
    pl = resp.json()
    pid = pl["id"]

    resp = client.get(f"/price_list/{pid}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["code"] == "PL123"

    resp = client.put(f"/price_list/{pid}", headers=auth_headers, json={"code": "PL123", "description": "Updated", "price": 15.0})
    assert resp.status_code == 200
    assert resp.json()["description"] == "Updated"

    resp = client.delete(f"/price_list/{pid}", headers=auth_headers)
    assert resp.status_code == 200

