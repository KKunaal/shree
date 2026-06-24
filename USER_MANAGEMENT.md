# User Management Feature

## Overview

This feature allows doctors to manage users (doctors and reception staff) in the hospital management system. Doctors can:

1. **Create new users** with username, password, and role assignment
2. **Edit user details** (username, role, active status)
3. **Change passwords** for themselves or other users
4. **Activate/Deactivate users** 
5. **Delete users**

## Features

### Backend

#### 1. User Model (`billing/models.py`)
- **Fields:**
  - `username` - Unique username for authentication
  - `password` - Hashed password (using Django's password hashers)
  - `role` - Either "doctor" or "reception"
  - `is_active` - Boolean flag to enable/disable users
  - `created_at` & `updated_at` - Timestamps

#### 2. Authentication (`billing/authentication.py`)
- Updated to check database first, then fall back to settings-based auth
- Maintains backward compatibility with existing credentials
- Uses Django's secure password hashing

#### 3. API Endpoints

**User Management** (Doctor only):
- `GET /api/users/` - List all users
- `POST /api/users/` - Create new user
- `GET /api/users/<id>/` - Get user details
- `PATCH /api/users/<id>/` - Update user
- `DELETE /api/users/<id>/` - Delete user

**Password Management** (All authenticated users):
- `POST /api/users/change-password/` - Change password
  - Self: `{ "current_password": "...", "new_password": "..." }`
  - Other (doctor only): `{ "user_id": 2, "current_password": "...", "new_password": "..." }`

#### 4. Management Command
```bash
python manage.py seed_users
```
Creates initial doctor and reception users with default passwords:
- Username: `doctor`, Password: `doctor@123`, Role: doctor
- Username: `reception`, Password: `reception@123`, Role: reception

### Frontend

#### 1. Configure Page (`pages/Configure.jsx`)
- Accessible only to doctors via the "👤 Configure" tab
- Shows a table of all users with:
  - Username
  - Role (with colored badges)
  - Status (Active/Inactive)
  - Creation date
  - Action buttons (Change Password, Edit, Activate/Deactivate, Delete)

#### 2. User Form Modal (`components/UserFormModal.jsx`)
- Create mode: Enter username, password, role, and active status
- Edit mode: Update role and active status (username cannot be changed)
- Validates password length (minimum 4 characters)

#### 3. Change Password Modal (`components/ChangePasswordModal.jsx`)
- Doctor can change any user's password by knowing their current password
- User can change their own password
- Requires current password verification
- Validates new password length
- Logs out user if they change their own password (security measure)

#### 4. Tab Navigation
All pages (Dashboard, Bills, Queue, Charges) now include a "Configure" tab for doctors.

## Usage

### Initial Setup

1. **Run migrations:**
   ```bash
   cd backend
   python manage.py makemigrations
   python manage.py migrate
   ```

2. **Seed initial users:**
   ```bash
   python manage.py seed_users
   ```

3. **Start the backend:**
   ```bash
   python manage.py runserver
   ```

4. **Start the frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

### Creating a New User (Doctor)

1. Login as a doctor
2. Navigate to "👤 Configure" tab
3. Click "+ Create User"
4. Fill in:
   - Username (unique)
   - Password (minimum 4 characters)
   - Role (doctor or reception)
   - Active status (checked = active)
5. Click "Create"

### Changing Password

#### As a Doctor (for any user):
1. Go to Configure page
2. Click "Change Password" next to any user
3. Enter the user's current password
4. Enter new password
5. Confirm new password
6. Click "Change Password"

#### As Any User (for self):
1. Go to Configure page (doctor) or ask doctor to initiate
2. Click "Change Password" next to your username
3. Enter your current password
4. Enter new password
5. Confirm new password
6. Click "Change Password"
7. You will be logged out and need to login with new password

### Editing User Details

1. Go to Configure page
2. Click "Edit" next to a user
3. Modify role or active status
4. Click "Update"

Note: Username cannot be changed once created

### Deactivating a User

1. Go to Configure page
2. Click "Deactivate" next to an active user
3. User will be marked inactive and cannot login

### Deleting a User

1. Go to Configure page
2. Click "Delete" next to a user
3. Confirm deletion
4. User is permanently removed

## Security Features

1. **Password Hashing**: All passwords are hashed using Django's `make_password` (PBKDF2 by default)
2. **Role-Based Access**: Only doctors can access user management
3. **Current Password Verification**: Changing password requires knowing the current password
4. **Automatic Logout**: Users are logged out when they change their own password
5. **Active Status**: Inactive users cannot authenticate

## Migration Path

The system maintains backward compatibility:
1. Existing settings-based credentials still work
2. New database users take precedence
3. You can gradually migrate users to database by creating them in Configure page
4. Eventually, you can remove settings-based credentials from `base.py`

## Database Schema

```sql
CREATE TABLE billing_user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(128) NOT NULL,
    role VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
```

## Future Enhancements

Potential improvements:
1. Add email field for password reset
2. Implement password complexity rules
3. Add password expiry/rotation policy
4. Audit log for user management actions
5. Bulk user import from CSV
6. User groups and advanced permissions
7. Two-factor authentication
8. Session management (force logout all sessions)
