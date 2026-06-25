# Migration Plan: Bill Model to Use PatientBasicProfile Foreign Key

## Current Structure

### Bill Model (Duplicated Fields)
- patient_name
- address
- mobile_no
- gender
- weight
- height
- age
- pulse_rate

### PatientBasicProfile Model (Source of Truth)
- patient_name
- address
- mobile_no
- gender
- age
- weight
- height
- pulse_rate
- + medical history fields

## Proposed Changes

### Step 1: Add Foreign Key (Non-Breaking)
Add `patient` ForeignKey to Bill model while keeping existing fields:
```python
patient = models.ForeignKey(
    PatientBasicProfile,
    on_delete=models.PROTECT,  # Prevent deletion if bills exist
    related_name="bills",
    null=True,  # Temporarily nullable for migration
    blank=True,
)
```

### Step 2: Data Migration
Create a migration to:
1. For each existing Bill without a patient FK:
   - Try to find matching PatientBasicProfile by (patient_name, mobile_no)
   - If found: Link to existing profile
   - If not found: Create new PatientBasicProfile from Bill data
   - Set Bill.patient to the profile

### Step 3: Make FK Required
Once all Bills have patient links:
- Remove null=True from patient FK
- Keep old fields for backward compatibility (deprecated)

### Step 4: Update Serializers (No Frontend Changes)
Modify BillSerializer to read from patient FK but still expose same fields:
```python
class BillSerializer(serializers.ModelSerializer):
    # Virtual fields that read from patient FK
    patient_name = serializers.CharField(source='patient.patient_name', read_only=True)
    address = serializers.CharField(source='patient.address', read_only=True)
    mobile_no = serializers.CharField(source='patient.mobile_no', read_only=True)
    gender = serializers.CharField(source='patient.gender', read_only=True)
    age = serializers.IntegerField(source='patient.age', read_only=True)
    weight = serializers.DecimalField(source='patient.weight', read_only=True)
    height = serializers.DecimalField(source='patient.height', read_only=True)
    pulse_rate = serializers.IntegerField(source='patient.pulse_rate', read_only=True)
    
    # On write, accept patient data and create/update profile
    def create(self, validated_data):
        # Extract patient data
        # Create or get PatientBasicProfile
        # Create Bill with patient FK
        pass
```

### Step 5: Future Cleanup (Optional)
After confirming everything works:
- Remove deprecated fields from Bill model
- This would be a breaking change requiring migration

## Migration Files Needed

### Migration 1: Add FK (0021_bill_patient_fk.py)
```python
operations = [
    migrations.AddField(
        model_name='bill',
        name='patient',
        field=models.ForeignKey(
            blank=True,
            null=True,
            on_delete=django.db.models.deletion.PROTECT,
            related_name='bills',
            to='billing.patientbasicprofile'
        ),
    ),
]
```

### Migration 2: Populate FK (0022_populate_bill_patient.py)
```python
def populate_patient_fk(apps, schema_editor):
    Bill = apps.get_model('billing', 'Bill')
    PatientBasicProfile = apps.get_model('billing', 'PatientBasicProfile')
    
    for bill in Bill.objects.filter(patient__isnull=True):
        # Try to find existing profile
        profile = PatientBasicProfile.objects.filter(
            patient_name=bill.patient_name,
            mobile_no=bill.mobile_no
        ).first()
        
        if not profile:
            # Create new profile from bill data
            profile = PatientBasicProfile.objects.create(
                patient_name=bill.patient_name,
                address=bill.address,
                mobile_no=bill.mobile_no,
                gender=bill.gender,
                age=bill.age,
                weight=bill.weight,
                height=bill.height,
                pulse_rate=bill.pulse_rate,
            )
        
        bill.patient = profile
        bill.save(update_fields=['patient'])

operations = [
    migrations.RunPython(populate_patient_fk, migrations.RunPython.noop),
]
```

### Migration 3: Make FK Required (0023_bill_patient_required.py)
```python
operations = [
    migrations.AlterField(
        model_name='bill',
        name='patient',
        field=models.ForeignKey(
            on_delete=django.db.models.deletion.PROTECT,
            related_name='bills',
            to='billing.patientbasicprofile'
        ),
    ),
]
```

## Benefits

1. **Single Source of Truth**: Patient data in one place
2. **No Frontend Changes**: Serializer compatibility maintains API contract
3. **Data Consistency**: Future patient updates auto-reflect in all bills
4. **Better Queries**: Can filter bills by patient profile
5. **Medical History Access**: Bills can access patient's medical conditions
6. **Deduplication**: Multiple bills for same patient share one profile

## Risks & Mitigations

### Risk 1: Duplicate Profiles
- **Issue**: Same patient might have multiple profiles (typos, phone changes)
- **Mitigation**: Matching logic in migration (name + mobile)

### Risk 2: Data Loss
- **Issue**: Migration failure could lose patient data
- **Mitigation**: Keep old fields, reversible migration

### Risk 3: Performance
- **Issue**: Additional JOIN on queries
- **Mitigation**: Use select_related('patient') in queries

## Testing Plan

1. Backup database before migration
2. Run migrations on copy of production data
3. Verify all bills have patient FK
4. Check API responses match original format
5. Test bill creation through UI
6. Verify patient profile updates reflect in bills

## Rollback Plan

If issues occur:
1. Revert code changes
2. Run reverse migration (keeps old fields)
3. Data remains intact in old fields
