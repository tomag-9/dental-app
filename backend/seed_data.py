"""Compatibility wrapper for seeding local demo data.

The canonical seed implementation lives in
``apps.core.management.commands.seed_users`` so it can be run with
``python manage.py seed_users``. This module keeps the older
``runscript seed_data`` and ``python seed_data.py`` workflows working.
"""

import os

import django
from django.core.management import call_command


def run():
    call_command("seed_users")


if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    django.setup()
    run()
