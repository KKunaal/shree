"""
Management command: python manage.py seed_rates

Populates ServiceRate with the standard hospital charge-master for
Shree Bal Rugnalaya.  Safe to run repeatedly — uses get_or_create so
existing records are not overwritten.
"""

from django.core.management.base import BaseCommand

from billing.models import ServiceRate

# (name, category, default_rate, unit)
DEFAULTS = [
    # ── OPD ──────────────────────────────────────────────────────────────────
    ("OPD – First Visit",      "OPD",       "300",  "per visit"),
    ("OPD – Second Visit",     "OPD",       "200",  "per visit"),
    ("OPD – Follow-up",        "OPD",       "150",  "per visit"),
    ("Emergency Consultation", "OPD",       "500",  "per visit"),
    # ── IPD ──────────────────────────────────────────────────────────────────
    ("I.P.D Charges",          "IPD",       "1400", "per day"),
    ("Monitoring",             "IPD",       "100",  "per day"),
    ("Neocan",                 "IPD",       "300",  "per day"),
    ("Consulting Charges",     "IPD",       "300",  "per day"),
    ("IV Fluids",              "IPD",       "150",  "per day"),
    ("Nebulization",           "IPD",       "20",   "per day"),
    ("O2 Charges",             "IPD",       "1500", "per day"),
    # ── Room ─────────────────────────────────────────────────────────────────
    ("Room Charges – General", "ROOM",      "1500", "per day"),
    ("Room Charges – Private", "ROOM",      "2500", "per day"),
    ("Room Charges – ICU",     "ROOM",      "5000", "per day"),
    # ── Nursing ──────────────────────────────────────────────────────────────
    ("Nursing Charges",        "NURSING",   "300",  "per day"),
    ("Night Nursing",          "NURSING",   "500",  "per night"),
    # ── Procedures ───────────────────────────────────────────────────────────
    ("Dressing",               "PROCEDURE", "200",  "per procedure"),
    ("Injection / IV",         "PROCEDURE", "50",   "per procedure"),
    ("Catheterization",        "PROCEDURE", "300",  "per procedure"),
    ("Suturing",               "PROCEDURE", "500",  "per procedure"),
    ("ECG",                    "PROCEDURE", "250",  "per procedure"),
    ("X-Ray",                  "PROCEDURE", "400",  "per procedure"),
    ("Sonography",             "PROCEDURE", "700",  "per procedure"),
    ("Procedure Charges",      "PROCEDURE", "0",    "per procedure"),
    # ── Other ─────────────────────────────────────────────────────────────────
    ("Emergency Charges",      "OTHER",     "500",  "per admission"),
    ("Ambulance Charges",      "OTHER",     "1000", "per trip"),
    ("Other Charges",          "OTHER",     "0",    "per item"),
]


class Command(BaseCommand):
    help = "Seed ServiceRate table with Shree Hospital default charge-master."

    def handle(self, *args, **options):
        created_count = 0
        for name, category, rate, unit in DEFAULTS:
            _, created = ServiceRate.objects.get_or_create(
                name=name,
                defaults={"category": category, "default_rate": rate, "unit": unit},
            )
            if created:
                created_count += 1

        skipped = len(DEFAULTS) - created_count
        self.stdout.write(
            self.style.SUCCESS(
                f"Done. {created_count} rate(s) created, {skipped} already existed."
            )
        )
