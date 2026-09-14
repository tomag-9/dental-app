"""Daily job: flip lapsed subscriptions into the read-only lock.

A failed payment puts a subscription into ``past_due`` (via the Stripe
webhook). The lab keeps full write access for ``SUBSCRIPTION_GRACE_DAYS`` so a
bounced card does not stop a working day; once that window closes this command
switches the subscription to ``read_only``. Reads and exports keep working —
patient records and MDR traceability stay available and portable.

Run it daily, e.g. from cron::

    python manage.py enforce_subscription_grace
"""

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.finance.stripe_service import enforce_grace_period


class Command(BaseCommand):
    help = "Switch past-due subscriptions to read-only once the grace period expires."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be locked without writing anything.",
        )

    def handle(self, *args, **options):
        days = getattr(settings, "SUBSCRIPTION_GRACE_DAYS", 14)
        if options["dry_run"]:
            from django.utils import timezone

            from apps.finance.models import Subscription

            now = timezone.now()
            candidates = Subscription.objects.filter(status=Subscription.STATUS_PAST_DUE, past_due_since__isnull=False)
            pending = [s for s in candidates if (s.grace_ends_at() or now) <= now]
            self.stdout.write(f"Dry run: {len(pending)} subscription(s) would go read-only.")
            return

        locked = enforce_grace_period()
        self.stdout.write(
            self.style.SUCCESS(f"Grace period {days} days: {locked} subscription(s) switched to read-only.")
        )
