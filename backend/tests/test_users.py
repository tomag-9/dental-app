def test_register_and_login(client):
    # register a new user
    resp = client.post("/users/register", json={"email": "newuser@test.local", "password": "newpass", "nickname": "newuser"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "newuser@test.local"
    assert data["nickname"] == "newuser"

    # login
    resp = client.post("/users/token", data={"username": "newuser@test.local", "password": "newpass"})
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    assert token


def test_get_users_requires_admin(client):
    # admin token should list users
    resp = client.post("/users/token", data={"username": "admin@test.local", "password": "password123"})
    assert resp.status_code == 200
    admin_token = resp.json()["access_token"]

    resp = client.get("/users/", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

    # normal user should get 403
    resp = client.post("/users/token", data={"username": "user1@test.local", "password": "userpass"})
    assert resp.status_code == 200
    user_token = resp.json()["access_token"]

    resp = client.get("/users/", headers={"Authorization": f"Bearer {user_token}"})
    assert resp.status_code == 403


def test_get_me_and_update_me(client):
    # login as admin
    resp = client.post("/users/token", data={"username": "admin@test.local", "password": "password123"})
    token = resp.json()["access_token"]

    # get me
    resp = client.get("/users/me/", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    me = resp.json()
    assert me["email"] == "admin@test.local"

    # update password only (not username, as that would invalidate the token)
    resp = client.put("/users/me/", headers={"Authorization": f"Bearer {token}"}, json={"password": "newpassword123"})
    assert resp.status_code == 200
    # No longer have username field, can check email or nickname instead
    assert resp.json()["email"] == "admin@test.local" or resp.json().get("nickname") == "admin"
    
    # verify new password works
    resp = client.post("/users/token", data={"username": "admin@test.local", "password": "newpassword123"})
    assert resp.status_code == 200
    
    # revert password for other tests
    new_token = resp.json()["access_token"]
    resp = client.put("/users/me/", headers={"Authorization": f"Bearer {new_token}"}, json={"password": "password123"})
    assert resp.status_code == 200

