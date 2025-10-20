# Testing Documentation

## Running Tests

### Local Development (with Docker)

Run all tests:
```bash
docker-compose exec backend pytest -v
```

Run specific test file:
```bash
docker-compose exec backend pytest tests/test_users.py -v
```

Run specific test:
```bash
docker-compose exec backend pytest tests/test_users.py::test_register_and_login -v
```

Run with coverage:
```bash
docker-compose exec backend pytest --cov=app --cov-report=html
```

### Local Development (without Docker)

Set up environment:
```bash
cd backend
pip install -r requirements.txt
export TESTING=1
```

Run tests:
```bash
cd backend
python -m pytest -v
```

### CI/CD (GitHub Actions)

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

The workflow is defined in `.github/workflows/tests.yml`

## Test Environment

### Environment Variable

**`TESTING=1`** must be set to prevent the app from attempting to connect to PostgreSQL database during test imports. When this variable is set:
- `app/main.py` skips database table creation at import time
- Tests use SQLite database instead of PostgreSQL
- Test database is created in `conftest.py`

### Test Database

- **Local/Docker**: File-based SQLite at `/tmp/test_dental_app.db`
- **CI/CD**: In-memory SQLite (no persistence needed)
- Tables created by `conftest.py` session fixture
- Cleaned up after all tests complete

### Test Configuration

Configuration is in `backend/pytest.ini`:
- Python path includes current directory and `app/`
- Test discovery in `tests/` directory
- Short traceback format for cleaner output

## Test Structure

```
backend/tests/
├── conftest.py              # Test configuration and fixtures
├── test_users.py            # User authentication tests
├── test_patients.py         # Patient management tests
├── test_jobs.py             # Job management tests
├── test_clinics_and_price_list.py  # Clinic and price list tests
├── test_doctors_technicians.py     # Doctor and technician tests
├── test_invoices.py         # Invoice tests
├── test_companies.py        # Company management tests (NEW)
├── test_vacations.py        # Vacation management tests (NEW)
└── test_edge_cases.py       # Security and edge case tests (NEW)
```

## Test Coverage

Current: **44 tests, 100% passing**

See `doc/test_coverage.md` for detailed coverage information.

### Coverage by Module

| Module | Tests | Status |
|--------|-------|--------|
| Users & Auth | 8 | ✅ |
| Patients | 1 | ✅ |
| Jobs | 1 | ✅ |
| Clinics & Price List | 1 | ✅ |
| Doctors & Technicians | 1 | ✅ |
| Invoices | 3 | ✅ |
| Companies | 10 | ✅ |
| Vacations | 5 | ✅ |
| Edge Cases & Security | 19 | ✅ |

## Key Fixtures (conftest.py)

### `setup_database` (session-scoped, autouse)
- Creates test database tables
- Seeds initial test data (admin user, test clinic, doctor, technician, patient, price list, jobs)
- Cleans up after all tests

### `db` (function-scoped)
- Provides database session for individual tests
- Rolls back changes after each test

### `client` (function-scoped)
- Provides TestClient for API testing
- Uses overridden database dependency

### `admin_token` (function-scoped)
- Provides authentication token for admin user
- Used in tests requiring authentication

### `auth_headers` (function-scoped)
- Provides authorization headers with Bearer token
- Convenience wrapper around admin_token

## Troubleshooting

### "no such table" errors
- Ensure `TESTING=1` environment variable is set
- Check that `conftest.py` is properly setting up the database
- Verify imports happen after setting `TESTING` env var

### Connection refused errors
- PostgreSQL connection attempt during import
- Set `TESTING=1` before importing app modules
- Check `app/main.py` conditional database creation

### Import errors
- Ensure `PYTHONPATH` includes backend directory
- `conftest.py` adds parent directory to sys.path automatically
- In CI/CD, working directory should be `backend/`

### Tests pass locally but fail in CI
- Check environment variables are set correctly in workflow
- Verify all dependencies are installed in CI
- Check database file permissions (SQLite)

## Adding New Tests

1. Create test file in `backend/tests/` with `test_` prefix
2. Import fixtures from conftest if needed:
   ```python
   def test_something(client, auth_headers):
       resp = client.get("/endpoint", headers=auth_headers)
       assert resp.status_code == 200
   ```

3. Use helper functions for common operations:
   ```python
   def get_token(client, username="admin", password="password123"):
       resp = client.post("/users/token", data={"username": username, "password": password})
       return resp.json()["access_token"]
   ```

4. Run tests to verify:
   ```bash
   docker-compose exec backend pytest tests/test_your_new_file.py -v
   ```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Clean up**: Use fixtures to ensure proper cleanup
3. **Descriptive names**: `test_create_user_with_duplicate_username`
4. **Arrange-Act-Assert**: Structure tests clearly
5. **Edge cases**: Test error conditions, not just happy paths
6. **Documentation**: Add docstrings to complex tests

## Future Improvements

- [ ] Add integration tests for complete workflows
- [ ] Add performance/load testing
- [ ] Add frontend component tests
- [ ] Increase coverage for toothmap endpoints
- [ ] Add API contract testing
- [ ] Set up test coverage reporting in CI
