# Testing Documentation

## Full Project Gate

Run the main checker from the repository root:

```bash
./check-all.sh
```

The checker expects the Docker Compose dev stack to be running:

```bash
docker compose --env-file env/dev.env.example -f compose/docker-compose.yml up
```

`./check-all.sh` runs:

- `npm run lint` in the frontend container
- `npm run build` in the frontend container
- `black apps config manage.py seed_data.py --check` in the backend container
- `flake8 apps config manage.py seed_data.py` in the backend container
- `python manage.py test --noinput --verbosity=2` in the backend container

It stores command logs in a temporary directory and prints concise failure summaries.

## Backend Tests

Run all Django tests:

```bash
docker compose --env-file env/dev.env.example -f compose/docker-compose.yml exec -T backend python manage.py test --noinput --verbosity=2
```

Run a focused test class:

```bash
docker compose --env-file env/dev.env.example -f compose/docker-compose.yml exec -T backend python manage.py test apps.jobs.tests.JobValidationApiTests --noinput --verbosity=2
```

## Frontend Checks

Run lint:

```bash
docker compose --env-file env/dev.env.example -f compose/docker-compose.yml exec -T frontend npm run lint
```

Run production build:

```bash
docker compose --env-file env/dev.env.example -f compose/docker-compose.yml exec -T frontend npm run build
```

## Coverage

The backend currently has functional Django test coverage across core, CRM, jobs, finance and inventory. A numeric coverage percentage is not generated yet because coverage tooling is not installed in the backend image.

See `doc/test_coverage.md` for the current coverage summary and remaining gaps.
