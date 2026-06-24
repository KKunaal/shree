"""
Management command to list all users and their password status.
Usage: python manage.py list_users
"""
from django.core.management.base import BaseCommand
from billing.models import User


class Command(BaseCommand):
    help = 'List all users and show which have plain_password stored'

    def handle(self, *args, **options):
        users = User.objects.all().order_by('role', 'username')
        
        if not users.exists():
            self.stdout.write(self.style.WARNING('No users found'))
            return
        
        self.stdout.write('\n' + '=' * 80)
        self.stdout.write(self.style.SUCCESS('USER LIST'))
        self.stdout.write('=' * 80 + '\n')
        
        for user in users:
            status = '✅ Has plain password' if user.plain_password else '❌ No plain password'
            active = '✓ Active' if user.is_active else '✗ Inactive'
            
            self.stdout.write(
                f'Username: {user.username:20} | '
                f'Role: {user.role:10} | '
                f'{active:10} | '
                f'{status}'
            )
            
            if user.plain_password:
                self.stdout.write(f'  → Password: {user.plain_password}')
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f'  → Run: python manage.py reset_user_password {user.username} <password>'
                    )
                )
            self.stdout.write('')
        
        self.stdout.write('=' * 80)
        total = users.count()
        with_password = users.exclude(plain_password__isnull=True).exclude(plain_password='').count()
        self.stdout.write(
            f'\nTotal: {total} users | '
            f'With password: {with_password} | '
            f'Without password: {total - with_password}\n'
        )
