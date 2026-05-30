# Frontend token storage note

Current frontend auth stores JWT access and refresh tokens in `localStorage`
under `molaris.access` and `molaris.refresh`.

This keeps the Vite-only frontend simple, but it means an XSS bug can read and
exfiltrate active tokens. Until the app moves to an httpOnly-cookie or BFF
session model, production hardening should assume that token storage is only as
safe as the JavaScript surface.

Minimum production controls for the current model:

- Keep access tokens short-lived and rely on refresh/session revocation.
- Use a strict Content Security Policy and avoid inline third-party scripts.
- Sanitize or avoid rendering untrusted HTML.
- Clear tokens on logout and on any API `401` response.
- Prefer the future target of httpOnly secure cookies, CSRF protection, and a
  backend-for-frontend refresh/session endpoint.
