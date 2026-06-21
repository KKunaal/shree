from django.core.management.base import BaseCommand

from billing.services import GoogleSheetsService


class Command(BaseCommand):
    help = "Ensure the Google Sheet has the correct header row in row 1."

    def handle(self, *args, **options):
        svc = GoogleSheetsService()
        written = svc.ensure_headers()
        if written:
            self.stdout.write(self.style.SUCCESS("✅  Sheet headers written successfully."))
        else:
            self.stdout.write(self.style.WARNING("ℹ️   Headers already exist — no changes made."))
