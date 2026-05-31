class ContentSecurityPolicyMiddleware:
    """Adds a Content-Security-Policy header to every response.

    'unsafe-inline' for scripts/styles is intentional — the existing React app
    uses inline styles and script injection. Tighten after the httpOnly cookie
    migration (PR 8) stabilises the auth surface.
    """

    # cdn.jsdelivr.net is required by drf-spectacular's Swagger UI for its JS/CSS/fonts.
    CSP = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "img-src 'self' data: blob: https://cdn.jsdelivr.net; "
        "font-src 'self' https://cdn.jsdelivr.net; "
        "connect-src 'self'; "
        "frame-ancestors 'none';"
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response["Content-Security-Policy"] = self.CSP
        return response
