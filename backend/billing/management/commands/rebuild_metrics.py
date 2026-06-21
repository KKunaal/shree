from django.core.management.base import BaseCommand

from billing.models import Metrics


class Command(BaseCommand):
    help = "Rebuild the Metrics singleton by recomputing from the Bills table."

    def handle(self, *args, **options):
        m = Metrics.rebuild()
        self.stdout.write(
            self.style.SUCCESS(
                f"Metrics rebuilt — "
                f"IPD: {m.total_ipd_bills}, "
                f"OPD: {m.total_opd_bills}, "
                f"Total collected: ₹{m.total_collected}"
            )
        )
