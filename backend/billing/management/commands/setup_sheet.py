from django.conf import settings
from django.core.management.base import BaseCommand

from billing.services import GoogleSheetsService


class Command(BaseCommand):
    help = "Ensure both IPD and OPD Google Sheets have the correct header rows."

    def _setup(self, bill_type: str):
        svc = GoogleSheetsService(bill_type=bill_type)
        label = f"{bill_type} sheet ({svc.worksheet_name})"
        try:
            written = svc.ensure_headers()
            if written:
                self.stdout.write(self.style.SUCCESS(f"✅  {label}: headers written."))
            else:
                self.stdout.write(self.style.WARNING(f"ℹ️   {label}: headers already present."))
        except ValueError as exc:
            self.stdout.write(self.style.WARNING(f"⏭️  {label}: skipped — {exc}"))

    def handle(self, *args, **options):
        self._setup("IPD")
        self._setup("OPD")
