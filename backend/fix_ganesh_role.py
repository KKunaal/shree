"""
Script to fix user role in database
This will update the ganesh user back to reception role
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, '/Users/kunal.ghanghav/Desktop/Shree/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hms.settings.dev')
django.setup()

from billing.models import User

# Find ganesh user
try:
    ganesh = User.objects.get(username='ganesh')
    
    print("\n" + "="*60)
    print("FIXING GANESH USER ROLE")
    print("="*60 + "\n")
    
    print(f"Current state:")
    print(f"  Username: {ganesh.username}")
    print(f"  Role: {ganesh.role}")
    print(f"  Active: {ganesh.is_active}")
    
    # Update to reception
    ganesh.role = 'reception'
    ganesh.save()
    
    print(f"\nUpdated to:")
    print(f"  Username: {ganesh.username}")
    print(f"  Role: {ganesh.role}")
    print(f"  Active: {ganesh.is_active}")
    
    print("\n" + "="*60)
    print("✅ User role updated successfully!")
    print("Ganesh can now login with reception privileges")
    print("="*60 + "\n")
    
except User.DoesNotExist:
    print("\n❌ User 'ganesh' not found in database\n")
    print("Available users:")
    for user in User.objects.all():
        print(f"  - {user.username} ({user.role})")
    print()
