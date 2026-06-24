# User Management UI Guide

## Navigation

### Tab Bar (Doctor View)
```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Dashboard  │  📋 Bills  │  🏥 Queue  │  ⚙️ Charges  │  👤 Configure  │
└─────────────────────────────────────────────────────────────────┘
```

The **Configure** tab appears only for doctors and is highlighted when active.

### Tab Bar (Reception View)
```
┌─────────────────────────────────────┐
│  📋 Bills  │  🏥 Queue  │
└─────────────────────────────────────┘
```

Reception users do NOT see Dashboard, Charges, or Configure tabs.

---

## Configure Page Layout

### Header Section
```
┌──────────────────────────────────────────────────────────────────┐
│  User Management                             [+ Create User]     │
└──────────────────────────────────────────────────────────────────┘
```

- **Left:** Page title
- **Right:** Blue button to create new users

### User Table

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Username    │ Role         │ Status      │ Created       │ Actions                              │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ doctor      │ [🟣 doctor]  │ [🟢 Active] │ Jun 24, 2026  │ Change Password | Edit | Deactivate | Delete │
│ reception   │ [🟢 reception]│ [🟢 Active] │ Jun 24, 2026  │ Change Password | Edit | Deactivate | Delete │
│ nurse1      │ [🟢 reception]│ [🔴 Inactive]│ Jun 24, 2026  │ Change Password | Edit | Activate   | Delete │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Badge Colors:
- **Role Badges:**
  - 🟣 Purple = Doctor
  - 🟢 Green = Reception

- **Status Badges:**
  - 🟢 Green = Active (can login)
  - 🔴 Red = Inactive (cannot login)

#### Action Buttons:
- **Change Password** (Indigo) - Opens password change modal
- **Edit** (Blue) - Opens edit user modal
- **Activate/Deactivate** (Orange/Green) - Toggles user status
- **Delete** (Red) - Deletes user (with confirmation)

---

## Create/Edit User Modal

### Create Mode

```
┌─────────────────────────────────────────┐
│  Create New User                   [×]  │
├─────────────────────────────────────────┤
│                                         │
│  Username                               │
│  ┌───────────────────────────────────┐ │
│  │ newuser                           │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Password                               │
│  ┌───────────────────────────────────┐ │
│  │ ••••••••••                        │ │
│  └───────────────────────────────────┘ │
│  Minimum 4 characters                   │
│                                         │
│  Role                                   │
│  ┌───────────────────────────────────┐ │
│  │ Reception              ▼          │ │
│  └───────────────────────────────────┘ │
│  Options: Reception, Doctor             │
│                                         │
│  ☑ Active                               │
│                                         │
│                                         │
│           [Cancel]      [Create]        │
└─────────────────────────────────────────┘
```

### Edit Mode

```
┌─────────────────────────────────────────┐
│  Edit User                         [×]  │
├─────────────────────────────────────────┤
│                                         │
│  Username                               │
│  ┌───────────────────────────────────┐ │
│  │ reception          [disabled]     │ │
│  └───────────────────────────────────┘ │
│  Username cannot be changed             │
│                                         │
│  Role                                   │
│  ┌───────────────────────────────────┐ │
│  │ Doctor                 ▼          │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ☑ Active                               │
│                                         │
│                                         │
│           [Cancel]      [Update]        │
└─────────────────────────────────────────┘
```

**Notes:**
- In Edit mode, username field is disabled (cannot be changed)
- Password field is not shown (use Change Password for that)
- Role can be changed between doctor and reception
- Active checkbox controls whether user can login

---

## Change Password Modal

### Changing Own Password

```
┌─────────────────────────────────────────┐
│  Change Password                   [×]  │
├─────────────────────────────────────────┤
│                                         │
│  Current Password                       │
│  ┌───────────────────────────────────┐ │
│  │ ••••••••••                        │ │
│  └───────────────────────────────────┘ │
│  Enter your current password            │
│                                         │
│  New Password                           │
│  ┌───────────────────────────────────┐ │
│  │ ••••••••••                        │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Confirm New Password                   │
│  ┌───────────────────────────────────┐ │
│  │ ••••••••••                        │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ⚠️  You will be logged out after│   │
│  │ changing your password and will │   │
│  │ need to login again.            │   │
│  └─────────────────────────────────┘   │
│                                         │
│         [Cancel]  [Change Password]     │
└─────────────────────────────────────────┘
```

### Doctor Changing Another User's Password

```
┌─────────────────────────────────────────┐
│  Change Password for reception     [×]  │
├─────────────────────────────────────────┤
│                                         │
│  Current Password                       │
│  ┌───────────────────────────────────┐ │
│  │ ••••••••••                        │ │
│  └───────────────────────────────────┘ │
│  Enter the current password for         │
│  reception                              │
│                                         │
│  New Password                           │
│  ┌───────────────────────────────────┐ │
│  │ ••••••••••                        │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Confirm New Password                   │
│  ┌───────────────────────────────────┐ │
│  │ ••••••••••                        │ │
│  └───────────────────────────────────┘ │
│                                         │
│         [Cancel]  [Change Password]     │
└─────────────────────────────────────────┘
```

**Notes:**
- When changing own password, warning about logout is shown
- When doctor changes another user's password, no logout warning
- All three password fields are required
- New password and confirm must match
- Current password must be correct

---

## Error States

### Validation Error (Create User)

```
┌─────────────────────────────────────────┐
│  Create New User                   [×]  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ❌ A user with that username    │   │
│  │    already exists.              │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Username                               │
│  ┌───────────────────────────────────┐ │
│  │ doctor                            │ │
│  └───────────────────────────────────┘ │
│  ...                                    │
└─────────────────────────────────────────┘
```

### Password Mismatch Error

```
┌─────────────────────────────────────────┐
│  Change Password                   [×]  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ❌ New passwords do not match   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ...                                    │
└─────────────────────────────────────────┘
```

### Wrong Current Password

```
┌─────────────────────────────────────────┐
│  Change Password                   [×]  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ❌ Current password is incorrect│   │
│  └─────────────────────────────────┘   │
│                                         │
│  ...                                    │
└─────────────────────────────────────────┘
```

---

## Loading States

### Loading Users

```
┌──────────────────────────────────────────────────────────────────┐
│  User Management                             [+ Create User]     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                             ⏳                                   │
│                      Loading users...                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Creating User

```
┌─────────────────────────────────────────┐
│  Create New User                   [×]  │
├─────────────────────────────────────────┤
│  ...                                    │
│                                         │
│         [Cancel]      [Saving...]       │
│                        [disabled]       │
└─────────────────────────────────────────┘
```

---

## Empty State

```
┌──────────────────────────────────────────────────────────────────┐
│  User Management                             [+ Create User]     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                             📝                                   │
│                No users found. Create one to get started.       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Delete Confirmation

When clicking the Delete button, a native browser confirmation dialog appears:

```
┌─────────────────────────────────────────┐
│  Confirm                                │
│                                         │
│  Are you sure you want to delete this   │
│  user?                                  │
│                                         │
│           [Cancel]      [OK]            │
└─────────────────────────────────────────┘
```

---

## Responsive Design Notes

### Desktop (> 768px)
- Table shows all columns
- Modals centered on screen
- Tab bar horizontal

### Tablet (> 640px)
- Table may scroll horizontally if needed
- Modals slightly narrower
- Tab bar horizontal but condensed

### Mobile (< 640px)
- Table scrolls horizontally
- Modals full width with padding
- Tab bar scrolls if too many tabs
- Action buttons may wrap to multiple lines

---

## Color Scheme

### Primary Colors
- **Blue (#2563EB):** Primary actions, active tab, links
- **Purple (#7C3AED):** Doctor role badge
- **Green (#059669):** Reception role, active status
- **Red (#DC2626):** Delete action, inactive status
- **Orange (#EA580C):** Deactivate action
- **Indigo (#4F46E5):** Change password action

### Neutral Colors
- **Gray 50-900:** Backgrounds, text, borders
- **White:** Modal backgrounds, card backgrounds

### Semantic Colors
- **Red 50/200/700:** Error messages
- **Yellow 50/200/700:** Warning messages
- **Green 50/200/700:** Success messages

---

## Accessibility Features

- All form inputs have labels
- Keyboard navigation works throughout
- Focus indicators visible
- Color is not the only indicator (text + icons)
- Sufficient color contrast ratios
- Screen reader friendly
- Error messages are descriptive

---

## User Flows

### Creating a New User
1. Click "👤 Configure" tab
2. Click "+ Create User" button
3. Fill in username, password, select role
4. Check/uncheck "Active" as needed
5. Click "Create"
6. User appears in table

### Editing a User
1. Click "Edit" button next to user
2. Change role or active status
3. Click "Update"
4. Changes reflected in table

### Changing Password (Own)
1. Click "Change Password" next to your username
2. Enter current password
3. Enter new password
4. Confirm new password
5. Click "Change Password"
6. Logged out automatically
7. Login with new password

### Changing Password (Other User, as Doctor)
1. Click "Change Password" next to any user
2. Enter that user's current password
3. Enter new password for them
4. Confirm new password
5. Click "Change Password"
6. Success message shown
7. That user must use new password on next login

### Deactivating a User
1. Click "Deactivate" next to active user
2. User status changes to "Inactive"
3. User cannot login anymore

### Deleting a User
1. Click "Delete" next to user
2. Confirm deletion in dialog
3. User removed from table
4. User deleted from database

---

## Tips for Users

### For Doctors:
- **Regularly review user list** - Check who has access
- **Deactivate instead of delete** - Preserves audit trail
- **Use strong passwords** - Minimum 4 chars but longer is better
- **Change default passwords** - Update doctor@123 and reception@123 immediately
- **Document password changes** - Keep a secure record of when passwords were changed

### For All Users:
- **Remember your username** - It cannot be changed
- **Keep password secure** - Don't share with others
- **Change password regularly** - Good security practice
- **Contact doctor to reset** - If you forget your password

### Best Practices:
- Create specific users for each staff member
- Don't share accounts
- Deactivate users when staff leave
- Use role-based access appropriately
- Test new user accounts before sharing credentials
