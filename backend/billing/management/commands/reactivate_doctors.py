"""
Management command to reactivate all doctor accounts.
Usage: python manage.py reactivate_doctors
"""
from django.core.management.base import BaseCommand
from billing.models import User


class Command(BaseCommand):
    help = 'Reactivate all doctor accounts that are inactive'

    def handle(self, *args, **options):
        # Find all inactive doctor accounts
        inactive_doctors = User.objects.filter(role='doctor', is_active=False)
        
        if not inactive_doctors.exists():
            self.stdout.write(self.style.SUCCESS('✅ All doctor accounts are already active'))
            return
        
        count = inactive_doctors.count()
        self.stdout.write(f'\nFound {count} inactive doctor account(s):')
        
        for doctor in inactive_doctors:
            self.stdout.write(f'  - {doctor.username}')
        
        # Reactivate all inactive doctors
        inactive_doctors.update(is_active=True)
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✅ Successfully reactivated {count} doctor account(s)!\n'
                f'   You can now login with these accounts.\n'
            )
        )
