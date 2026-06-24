"""
Quick script to reset doctor password and display it
Run: python reset_doctor_pwd.py
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, '/Users/kunal.ghanghav/Desktop/Shree/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hms.settings.dev')
django.setup()

from billing.models import User

# Get all doctor users
doctors = User.objects.filter(role='doctor')

print("\n" + "="*60)
print("DOCTOR ACCOUNTS - PASSWORD RESET")
print("="*60 + "\n")

if not doctors.exists():
    print("❌ No doctor accounts found!")
    sys.exit(1)

for doctor in doctors:
    # Reset password to 'admin' (you can change this)
    new_password = 'admin'
    doctor.set_password(new_password)
    doctor.is_active = True  # Make sure they're active
    doctor.save()
    
    print(f"✅ Username: {doctor.username}")
    print(f"   Password: {new_password}")
    print(f"   Role: {doctor.role}")
    print(f"   Active: {doctor.is_active}")
    print(f"   Plain Password: {doctor.plain_password}")
    print()

print("="*60)
print(f"Total: {doctors.count()} doctor account(s) reset")
print("You can now login with the credentials above!")
print("="*60 + "\n")
