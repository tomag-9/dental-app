from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Creates a test user and admin if they do not exist"

    def handle(self, *args, **options):
        # Create Superuser
        if not User.objects.filter(username="admin").exists():
            User.objects.create_superuser("admin", "admin@example.com", "admin")
            self.stdout.write(
                self.style.SUCCESS('Superuser "admin" created (password: admin)')
            )
        else:
            self.stdout.write(self.style.WARNING('Superuser "admin" already exists'))

        # Create Normal User
        if not User.objects.filter(username="user").exists():
            user = User.objects.create_user("user", "user@example.com", "user")
            self.stdout.write(
                self.style.SUCCESS('Test user "user" created (password: user)')
            )
        else:
            self.stdout.write(self.style.WARNING('Test user "user" already exists'))
