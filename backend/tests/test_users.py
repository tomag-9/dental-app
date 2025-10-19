def test_register_and_login(client):
    # register a new user
    resp = client.post("/users/register", json={"username": "newuser", "password": "newpass"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "newuser"

    # login
    resp = client.post("/users/token", data={"username": "newuser", "password": "newpass"})
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    assert token


def test_get_users_requires_admin(client):
    # admin token should list users
    resp = client.post("/users/token", data={"username": "admin", "password": "password123"})
    assert resp.status_code == 200
    admin_token = resp.json()["access_token"]

    resp = client.get("/users/", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

    # normal user should get 403
    resp = client.post("/users/token", data={"username": "user1", "password": "userpass"})
    assert resp.status_code == 200
    user_token = resp.json()["access_token"]

    resp = client.get("/users/", headers={"Authorization": f"Bearer {user_token}"})
    assert resp.status_code == 403


def test_get_me_and_update_me(client):
    # login as admin
    resp = client.post("/users/token", data={"username": "admin", "password": "password123"})
    token = resp.json()["access_token"]

    # get me
    resp = client.get("/users/me/", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    me = resp.json()
    assert me["username"] == "admin"

    # update me username
    resp = client.put("/users/me/", headers={"Authorization": f"Bearer {token}"}, json={"username": "admin2", "password": "password123"})
    assert resp.status_code == 200
    assert resp.json()["username"] == "admin2"

    # revert username so other tests aren't affected
    resp = client.put("/users/me/", headers={"Authorization": f"Bearer {token}"}, json={"username": "admin", "password": "password123"})
    assert resp.status_code == 200

