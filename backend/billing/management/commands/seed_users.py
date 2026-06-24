"""
Management command to seed initial users (doctor and reception).
Run with: python manage.py seed_users
"""
from django.core.management.base import BaseCommand
from billing.models import User


class Command(BaseCommand):
    help = "Create initial doctor and reception users if they don't exist"

    def handle(self, *args, **options):
        users_created = 0
        
        # Create doctor user
        if not User.objects.filter(username="doctor").exists():
            doctor = User(username="doctor", role="doctor")
            doctor.set_password("doctor@123")
            doctor.save()
            self.stdout.write(self.style.SUCCESS("✓ Created user: doctor (role: doctor)"))
            users_created += 1
        else:
            self.stdout.write("• User 'doctor' already exists")
        
        # Create reception user
        if not User.objects.filter(username="reception").exists():
            reception = User(username="reception", role="reception")
            reception.set_password("reception@123")
            reception.save()
            self.stdout.write(self.style.SUCCESS("✓ Created user: reception (role: reception)"))
            users_created += 1
        else:
            self.stdout.write("• User 'reception' already exists")
        
        if users_created > 0:
            self.stdout.write(self.style.SUCCESS(f"\n✓ Seeded {users_created} user(s)"))
        else:
            self.stdout.write(self.style.WARNING("\n• All users already exist"))
