"""
Signals that keep the Metrics singleton in sync with the Bill table.
Every time a Bill is created, updated, or deleted the cumulative totals
are recomputed from scratch (3 cheap aggregate queries).
"""

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Bill, Metrics


@receiver(post_save, sender=Bill)
def _bill_saved(sender, instance, **kwargs):
    Metrics.rebuild()


@receiver(post_delete, sender=Bill)
def _bill_deleted(sender, instance, **kwargs):
    Metrics.rebuild()
