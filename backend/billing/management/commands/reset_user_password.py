"""
Management command to reset a user's password and store the plain text version.
Usage: python manage.py reset_user_password <username> <new_password>
"""
from django.core.management.base import BaseCommand
from billing.models import User


class Command(BaseCommand):
    help = 'Reset a user password and store plain text version'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='Username of the user')
        parser.add_argument('password', type=str, help='New password for the user')

    def handle(self, *args, **options):
        username = options['username']
        password = options['password']
        
        try:
            user = User.objects.get(username=username)
            user.set_password(password)  # This will set both hashed and plain_password
            user.save()
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ Password updated for user "{username}"\n'
                    f'   Role: {user.role}\n'
                    f'   Plain password: {user.plain_password}\n'
                    f'   Password is now visible in the UI when editing this user.'
                )
            )
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'❌ User "{username}" not found')
            )
