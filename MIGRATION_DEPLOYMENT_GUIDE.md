# Bill-Patient FK Migration - Deployment Guide

## Overview
This migration adds a foreign key relationship from Bill to PatientBasicProfile, making patient data centralized and eliminating duplication.

## Pre-Migration Checklist

### 1. Backup Database
```bash
# For SQLite (development/production)
cp backend/db.sqlite3 backend/db.sqlite3.backup.$(date +%Y%m%d_%H%M%S)

# For PostgreSQL (if using in production)
pg_dump dbname > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Check Current State
```python
# Run Django shell
python manage.py shell

# Check bill count
from billing.models import Bill
print(f"Total bills: {Bill.objects.count()}")

# Check patient profiles
from billing.models import PatientBasicProfile  
print(f"Total patient profiles: {PatientBasicProfile.objects.count()}")

# Check bills without mobile numbers (may create duplicate profiles)
print(f"Bills without mobile: {Bill.objects.filter(mobile_no='').count()}")
```

### 3. Review Migration Plan
Read `BILL_PATIENT_FK_MIGRATION_PLAN.md` thoroughly

## Migration Steps

### Step 1: Run First Migration (Add FK)
```bash
cd backend
python manage.py migrate billing 0021_bill_patient_fk
```

**Expected Output:**
```
Running migrations:
  Applying billing.0021_bill_patient_fk... OK
```

**Verify:**
```python
python manage.py shell
from billing.models import Bill
# Check that field exists but is null
print(Bill._meta.get_field('patient'))
print(f"Bills with patient: {Bill.objects.filter(patient__isnull=False).count()}")
# Should be 0 initially
```

### Step 2: Run Data Migration (Populate FK)
```bash
python manage.py migrate billing 0022_populate_bill_patient
```

**Expected Output:**
```
Running migrations:
  Applying billing.0022_populate_bill_patient...
✅ Bill-Patient FK Migration Complete:
   - Bills processed: XXX
   - Existing profiles reused: YYY
   - New profiles created: ZZZ
OK
```

**Verify:**
```python
python manage.py shell
from billing.models import Bill, PatientBasicProfile

# Check all bills have patient FK
null_count = Bill.objects.filter(patient__isnull=True).count()
print(f"Bills without patient FK: {null_count}")  # Should be 0

# Verify profiles were created
profile_count = PatientBasicProfile.objects.count()
print(f"Total patient profiles: {profile_count}")

# Check a sample bill
bill = Bill.objects.first()
print(f"Bill: {bill.patient_name}")
print(f"Linked Patient: {bill.patient.patient_name}")
print(f"Match: {bill.patient_name == bill.patient.patient_name}")
```

### Step 3 (Optional): Make FK Required
⚠️ **Only after confirming Step 2 was successful!**

```bash
python manage.py migrate billing 0023_bill_patient_required
```

## Testing After Migration

### Test 1: Existing Bills Display Correctly
```bash
# Start development server
./scripts/start-dev.sh

# In browser:
# 1. Navigate to Bills page
# 2. Verify all bills show patient names correctly
# 3. Open a bill detail - check all patient info displays
```

### Test 2: Create New Bill
```bash
# In browser:
# 1. Go to Queue
# 2. Add new patient
# 3. Mark as Done -> Create Bill
# 4. Verify bill creation works
# 5. Check that patient profile was created/linked
```

**Verify in shell:**
```python
from billing.models import Bill
latest_bill = Bill.objects.latest('created_at')
print(f"Latest bill patient FK: {latest_bill.patient}")
print(f"Patient name match: {latest_bill.patient_name == latest_bill.patient.patient_name}")
```

### Test 3: Patient Profile Updates Reflect in Bills
```python
# In Django admin or shell
from billing.models import Bill, PatientBasicProfile

# Find a patient with multiple bills
patient = PatientBasicProfile.objects.annotate(
    bill_count=models.Count('bills')
).filter(bill_count__gt=1).first()

print(f"Patient: {patient.patient_name}")
print(f"Bills: {patient.bills.count()}")

# Update patient address
old_address = patient.address
patient.address = "New Test Address 123"
patient.save()

# Check all bills now show new address via FK
for bill in patient.bills.all():
    print(f"Bill #{bill.id}: {bill.patient.address}")
    # Should all show "New Test Address 123"
```

## Rollback Procedure

If issues occur, roll back migrations:

```bash
# Rollback to before FK was added
python manage.py migrate billing 0019_user

# Or just rollback data population (keep FK field)
python manage.py migrate billing 0021_bill_patient_fk
```

**Data Safety:**
- All original patient data remains in Bill model fields
- PatientBasicProfile records created by migration remain (won't cause issues)
- Bills will work with old fields until migration is re-run

## Post-Migration Monitoring

### Check for Issues
```bash
# View Django logs for any errors
tail -f backend/django.log

# Check for NULL patient FKs (should be 0)
python manage.py shell
from billing.models import Bill
print(f"Bills with null patient: {Bill.objects.filter(patient__isnull=True).count()}")
```

### Monitor Performance
```python
# Check query performance with FK
from django.db import connection
from billing.models import Bill

# Enable query logging
from django.conf import settings
settings.DEBUG = True

# Fetch bills (should use JOIN now)
bills = list(Bill.objects.select_related('patient')[:10])
print(f"Queries executed: {len(connection.queries)}")
for query in connection.queries:
    print(query['sql'])
```

## Future Optimizations

### 1. Update Views to Use select_related
```python
# In views.py, update bill queries:
Bill.objects.select_related('patient').all()
# This reduces database queries from N+1 to 1
```

### 2. Update Serializers (Phase 2)
Eventually update serializers to read from patient FK:
```python
class BillSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.patient_name')
    # ... other patient fields
```

### 3. Remove Deprecated Fields (Phase 3)
After 100% confidence, create migration to drop old fields:
- patient_name
- address
- mobile_no
- gender
- age
- weight
- height
- pulse_rate

## Success Criteria

✅ All bills have patient FK populated  
✅ No NULL patient references  
✅ Bill creation works through UI  
✅ Patient info displays correctly  
✅ No performance degradation  
✅ All tests pass  

## Support

If issues occur:
1. Check migration output for errors
2. Verify database backup exists
3. Review `BILL_PATIENT_FK_MIGRATION_PLAN.md`
4. Check Django logs for exceptions
5. Test rollback procedure in development first
