from drf_spectacular.management.commands.spectacular import Command as SpectacularCommand


class Command(SpectacularCommand):
    help = "Generate the OpenAPI schema using drf-spectacular."
