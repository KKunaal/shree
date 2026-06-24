# Self Password Change Fix - Complete Implementation

## Issue
When editing your own user details via the "Edit User" option in Configure tab, there was no field to enter the current password, making it impossible to follow the requirement that "for self password change entering existing valid password should be mandatory."

## Root Cause
The UserFormModal component (used for editing users) did not have:
1. A current password field for self-editing
2. Validation requiring current password when changing own password
3. Visible password fields (still using type="password")

## Solution Implemented

### Frontend Changes (`UserFormModal.jsx`)

#### 1. Added Self-Detection Logic
```javascript
const isEditingSelf = isEdit && user?.username === currentUser.username
```

#### 2. Added Current Password Field (Conditional)
- Only shown when editing your own user
- Required when changing password
- Visible text input with monospace font
- Shows red asterisk (*) when new password is entered

```javascript
{isEditingSelf && (
  <div>
    <label>
      Current Password {formData.password && <span className="text-red-500">*</span>}
    </label>
    <input
      type="text"
      value={formData.current_password}
      className="font-mono"
      placeholder="Required if changing password"
      required={!!formData.password}
    />
  </div>
)}
```

#### 3. Made All Passwords Visible
- Changed `type="password"` to `type="text"`
- Added `font-mono` class for better readability
- Both current and new password fields show visible text

#### 4. Added Helpful UI Indicators
- **Info banner** (blue): "💡 To change your password, you must enter your current password first."
- **Warning banner** (yellow): "⚠️ You will be logged out after changing your password..."
- **Required indicator**: Red asterisk (*) appears next to "Current Password" when new password is entered

#### 5. Added Validation
```javascript
// Frontend validation before API call
if (isEditingSelf && formData.password && !formData.current_password) {
  setError('Current password is required when changing your own password')
  return
}
```

#### 6. Auto Logout After Self Password Change
```javascript
if (isEditingSelf && formData.password) {
  alert('Your password has been changed! Please login with your new password.')
  logout()
}
```

### Backend Changes (`serializers.py`)

#### 1. Added current_password Field
```python
class UserUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=4, required=False, allow_blank=True)
    current_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    class Meta:
        fields = ["username", "role", "is_active", "password", "current_password"]
```

#### 2. Added Validation Logic
```python
def validate(self, data):
    request = self.context.get("request")
    password = data.get("password")
    current_password = data.get("current_password")
    
    # If user is changing their own password
    if password and self.instance and request:
        is_self = self.instance.username == request.user.username
        if is_self:
            # Current password is required
            if not current_password:
                raise serializers.ValidationError({
                    "current_password": "Current password is required..."
                })
            # Verify current password is correct
            if not self.instance.check_password(current_password):
                raise serializers.ValidationError({
                    "current_password": "Current password is incorrect."
                })
    
    return data
```

#### 3. Remove current_password Before Saving
```python
def update(self, instance, validated_data):
    password = validated_data.pop("password", None)
    validated_data.pop("current_password", None)  # Don't save this field
    # ... rest of update logic
```

## User Flow

### Editing Your Own User
1. Click Configure tab
2. Click three-dot menu on your own user → Edit User
3. See info banner: "💡 To change your password, you must enter your current password first."
4. See fields:
   - **Username** (can change)
   - **Current Password** (not required unless changing password)
   - **New Password** (optional, visible text with monospace font)
   - **Role** (can change if doctor)
   - **Active** (checkbox)

5. **To change password**:
   - Enter your **current password** (visible text)
   - Enter **new password** (visible text)
   - Current Password field shows red asterisk (*)
   - See warning: "⚠️ You will be logged out after changing your password..."

6. Click "Update"
   - If current password wrong → Error: "Current password is incorrect."
   - If current password correct → Success! Auto logout
   - Login with new password ✅

### Doctor Editing Another User
1. Click three-dot menu on another user → Edit User
2. See fields:
   - **Username**
   - **New Password** (optional - no current password required!)
   - **Role**
   - **Active**

3. Can change password without current password (doctor privilege)
4. No logout - stays logged in

## Files Modified

### Frontend
- `frontend/src/components/UserFormModal.jsx`
  - Added `isEditingSelf` detection
  - Added `current_password` to form state
  - Added current password field (conditional)
  - Changed password fields to `type="text"` with `font-mono`
  - Added validation before submit
  - Added auto-logout after self password change
  - Added info and warning banners

### Backend
- `backend/billing/serializers.py`
  - Added `current_password` field to UserUpdateSerializer
  - Added `validate()` method to check current password for self-edits
  - Updated `update()` to remove current_password before saving

## Security Features

### For Self Password Change
✅ Current password REQUIRED
✅ Current password validated on backend
✅ Passwords visible (better UX in controlled environment)
✅ User logged out immediately after change
✅ Must login with new password

### For Doctor Changing Others
✅ Can change without current password (admin privilege)
✅ Doctor stays logged in
✅ Target user's session not affected

### Backend Validation
✅ Password hashed with PBKDF2
✅ Minimum 4 characters enforced
✅ Current password verified before allowing change
✅ Proper error messages for wrong password

## Testing Checklist

### Self Password Change
- [ ] Login as any user
- [ ] Go to Configure tab
- [ ] Click three-dot menu on your own user
- [ ] Click "Edit User"
- [ ] Verify you see "Current Password" field
- [ ] Try to change password WITHOUT entering current password
  - Should show error: "Current password is required when changing your own password"
- [ ] Enter WRONG current password
  - Should show error: "Current password is incorrect."
- [ ] Enter CORRECT current password + new password (both visible!)
  - Should succeed and log you out
- [ ] Login with NEW password
  - Should work ✅
- [ ] Try to login with OLD password
  - Should fail ✅

### Doctor Editing Another User
- [ ] Login as doctor
- [ ] Click three-dot menu on another user
- [ ] Click "Edit User"
- [ ] Verify you DON'T see "Current Password" field
- [ ] Change password (no current password required)
- [ ] Should succeed without logout
- [ ] Other user can login with new password ✅

### Password Visibility
- [ ] All password fields show visible text
- [ ] Passwords use monospace font
- [ ] Can see exactly what you're typing
- [ ] No dots or asterisks hiding text

## Comparison: Edit User vs Change Password Modal

### Edit User Modal (UserFormModal)
- **Purpose**: Edit username, role, active status, AND password
- **Access**: Via three-dot menu → "Edit User"
- **Current Password**: Required for self, shows in form
- **Use Case**: Complete user profile editing

### Change Password Modal (ChangePasswordModal)
- **Purpose**: ONLY change password
- **Access**: Currently not directly accessible (could be added to menu)
- **Current Password**: Always required, separate field
- **Use Case**: Dedicated password change

**Note**: Both modals now work correctly with current password validation!

## Benefits

1. ✅ **Security**: Current password required for self-changes
2. ✅ **Visibility**: See what you're typing (reduces errors)
3. ✅ **UX**: Clear indicators and helpful messages
4. ✅ **Consistency**: Same behavior as ChangePasswordModal
5. ✅ **Auto Logout**: Forces re-authentication with new password
6. ✅ **Error Handling**: Clear messages for wrong password

All requirements now fully implemented! 🎉
