# User Management Testing Checklist

## Pre-Testing Setup

- [ ] Backend server running (`python manage.py runserver`)
- [ ] Frontend server running (`npm run dev`)
- [ ] Migrations applied (`python manage.py migrate`)
- [ ] Initial users seeded (`python manage.py seed_users`)

## Backend Testing

### Authentication Tests

- [ ] Login as doctor (username: `doctor`, password: `doctor@123`)
  - [ ] Should succeed and return doctor role
- [ ] Login as reception (username: `reception`, password: `reception@123`)
  - [ ] Should succeed and return reception role
- [ ] Login with wrong password
  - [ ] Should fail with 401 Unauthorized
- [ ] Login with non-existent user
  - [ ] Should fail with 401 Unauthorized

### User List API Tests (Doctor Only)

- [ ] GET `/api/users/` as doctor
  - [ ] Should return list of all users
  - [ ] Should include id, username, role, is_active, timestamps
  - [ ] Password should NOT be included in response
- [ ] GET `/api/users/` as reception
  - [ ] Should return 403 Forbidden

### Create User API Tests (Doctor Only)

- [ ] POST `/api/users/` as doctor with valid data
  - [ ] Should create user and return 201
  - [ ] Password should be hashed in database
- [ ] POST `/api/users/` with duplicate username
  - [ ] Should return 400 with validation error
- [ ] POST `/api/users/` with password < 4 characters
  - [ ] Should return 400 with validation error
- [ ] POST `/api/users/` as reception
  - [ ] Should return 403 Forbidden
- [ ] POST `/api/users/` with missing required fields
  - [ ] Should return 400 with validation error

### Update User API Tests (Doctor Only)

- [ ] PATCH `/api/users/{id}/` as doctor to change role
  - [ ] Should update successfully
- [ ] PATCH `/api/users/{id}/` as doctor to change is_active
  - [ ] Should update successfully
- [ ] PATCH `/api/users/{id}/` as reception
  - [ ] Should return 403 Forbidden
- [ ] PATCH `/api/users/{id}/` with invalid role
  - [ ] Should return 400 with validation error

### Delete User API Tests (Doctor Only)

- [ ] DELETE `/api/users/{id}/` as doctor
  - [ ] Should delete user and return 204
- [ ] DELETE `/api/users/{id}/` as reception
  - [ ] Should return 403 Forbidden
- [ ] DELETE `/api/users/{id}/` with non-existent ID
  - [ ] Should return 404 Not Found

### Change Password API Tests

#### Self Password Change
- [ ] POST `/api/users/change-password/` with correct current password
  - [ ] Should update password successfully
  - [ ] Should be able to login with new password
  - [ ] Should NOT be able to login with old password
- [ ] POST `/api/users/change-password/` with wrong current password
  - [ ] Should return 400 with error message
- [ ] POST `/api/users/change-password/` with new password < 4 characters
  - [ ] Should return 400 with validation error

#### Doctor Changing Other User's Password
- [ ] POST `/api/users/change-password/` as doctor with user_id
  - [ ] Should update other user's password
  - [ ] Other user should login with new password
- [ ] POST `/api/users/change-password/` as reception with user_id
  - [ ] Should return 403 Forbidden

### Database Tests

- [ ] Check User table exists
  ```sql
  SELECT * FROM billing_user;
  ```
- [ ] Verify passwords are hashed (not plain text)
- [ ] Verify created_at and updated_at timestamps

## Frontend Testing

### Navigation Tests

- [ ] Login as doctor
  - [ ] Should see Dashboard, Bills, Queue, Charges, Configure tabs
- [ ] Login as reception
  - [ ] Should see Bills, Queue tabs only
  - [ ] Should NOT see Dashboard, Charges, Configure tabs
- [ ] Click Configure tab as doctor
  - [ ] Should navigate to user management page

### Configure Page Tests

#### User List Display
- [ ] Configure page shows table of users
- [ ] Each user row shows:
  - [ ] Username
  - [ ] Role badge (purple for doctor, green for reception)
  - [ ] Status badge (green for active, red for inactive)
  - [ ] Created date
  - [ ] Action buttons
- [ ] Initial users (doctor, reception) are visible

#### Create User Tests
- [ ] Click "+ Create User" button
  - [ ] Modal should open
- [ ] Fill form with valid data and submit
  - [ ] User should be created
  - [ ] Modal should close
  - [ ] New user should appear in list
- [ ] Try creating user with duplicate username
  - [ ] Should show error message
- [ ] Try creating user with password < 4 characters
  - [ ] Should show error message
- [ ] Try creating user with empty username
  - [ ] Should show HTML5 validation error
- [ ] Cancel button should close modal without creating user

#### Edit User Tests
- [ ] Click "Edit" on a user
  - [ ] Modal should open with user data
  - [ ] Username field should be disabled
- [ ] Change role and save
  - [ ] User should be updated
  - [ ] Modal should close
  - [ ] Updated role should show in list
- [ ] Toggle is_active and save
  - [ ] User status should update in list
- [ ] Cancel button should close modal without saving

#### Change Password Tests
- [ ] Click "Change Password" on own user
  - [ ] Modal should open
  - [ ] Should show warning about logout
- [ ] Enter valid passwords (current, new, confirm)
  - [ ] Should change password successfully
  - [ ] Should logout automatically
  - [ ] Should be able to login with new password
- [ ] Click "Change Password" on other user (as doctor)
  - [ ] Modal should open
  - [ ] Should show "for {username}" in title
- [ ] Enter wrong current password
  - [ ] Should show error message
- [ ] Enter non-matching new passwords
  - [ ] Should show error message
- [ ] Enter new password < 4 characters
  - [ ] Should show error message
- [ ] Cancel button should close modal

#### Activate/Deactivate Tests
- [ ] Click "Deactivate" on active user
  - [ ] User status should change to inactive (red badge)
  - [ ] Button should change to "Activate"
- [ ] Click "Activate" on inactive user
  - [ ] User status should change to active (green badge)
  - [ ] Button should change to "Deactivate"
- [ ] Inactive user should NOT be able to login

#### Delete User Tests
- [ ] Click "Delete" on a user
  - [ ] Confirmation dialog should appear
- [ ] Confirm deletion
  - [ ] User should be removed from list
  - [ ] User should be deleted from database
- [ ] Cancel deletion
  - [ ] User should remain in list

### UI/UX Tests

- [ ] Modal overlays are properly centered
- [ ] Modal backgrounds are semi-transparent
- [ ] Clicking outside modal doesn't close it (prevented)
- [ ] Form validation shows clear error messages
- [ ] Success/error alerts are visible and clear
- [ ] Loading states show spinning indicators
- [ ] Tables are responsive on small screens
- [ ] Badges have appropriate colors
- [ ] Buttons have hover effects
- [ ] Active tab is highlighted

### Error Handling Tests

- [ ] Network error when fetching users
  - [ ] Should show error message
- [ ] Server error (500) on create user
  - [ ] Should show error message
- [ ] Unauthorized (401) when token expires
  - [ ] Should handle appropriately

### Tab Navigation Tests

- [ ] From Configure, click Dashboard tab
  - [ ] Should navigate to Dashboard
- [ ] From Configure, click Bills tab
  - [ ] Should navigate to Bills
- [ ] From Configure, click Queue tab
  - [ ] Should navigate to Queue
- [ ] From Configure, click Charges tab
  - [ ] Should navigate to Charges
- [ ] URL parameter should update (?tab=configure)
- [ ] Refreshing page should stay on Configure tab

## Integration Tests

### End-to-End User Flow
1. [ ] Login as doctor
2. [ ] Navigate to Configure page
3. [ ] Create new reception user
4. [ ] Logout
5. [ ] Login with new user credentials
6. [ ] Verify reception user sees correct tabs
7. [ ] Logout
8. [ ] Login as doctor again
9. [ ] Change new user's password
10. [ ] Logout
11. [ ] Login with new user and new password
12. [ ] Logout
13. [ ] Login as doctor
14. [ ] Deactivate new user
15. [ ] Logout
16. [ ] Try to login with deactivated user (should fail)
17. [ ] Login as doctor
18. [ ] Delete new user
19. [ ] Verify user is removed

### Password Security Flow
1. [ ] Create user with password "test1234"
2. [ ] Verify password is hashed in database (not plain text)
3. [ ] Login with correct password (should succeed)
4. [ ] Login with wrong password (should fail)
5. [ ] Change password to "newpass123"
6. [ ] Verify old password no longer works
7. [ ] Verify new password works

### Permission Flow
1. [ ] Login as reception
2. [ ] Try to access Configure tab (should be hidden)
3. [ ] Try to access /api/users/ directly (should get 403)
4. [ ] Login as doctor
5. [ ] Access Configure tab (should work)
6. [ ] Create/Edit/Delete users (should work)

## Browser Compatibility Tests

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

## Security Tests

- [ ] Passwords are never visible in network requests (base64 is not encryption!)
- [ ] Passwords are hashed in database
- [ ] Session tokens expire appropriately
- [ ] Non-doctors cannot access user management
- [ ] SQL injection attempts are prevented
- [ ] XSS attempts are prevented
- [ ] CSRF protection is enabled

## Performance Tests

- [ ] User list loads quickly (< 1 second)
- [ ] Create user responds quickly (< 1 second)
- [ ] No memory leaks when opening/closing modals multiple times
- [ ] Table renders smoothly with 50+ users

## Bug Tests

- [ ] No console errors in browser
- [ ] No Python errors in terminal
- [ ] No SQL errors
- [ ] No 500 errors from API
- [ ] Forms validate correctly
- [ ] Modals don't break layout

## Documentation Tests

- [ ] USER_MANAGEMENT.md is complete and accurate
- [ ] IMPLEMENTATION_SUMMARY.md is complete and accurate
- [ ] API_REFERENCE.md is complete and accurate
- [ ] Code comments are clear and helpful

## Deployment Readiness

- [ ] All migrations are committed
- [ ] Environment variables documented
- [ ] seed_users command documented
- [ ] Default passwords documented (with security warning)
- [ ] Database backup strategy documented
- [ ] Rollback plan documented

---

## Test Results

**Date:** _____________

**Tested By:** _____________

**Overall Status:** [ ] Pass [ ] Fail

**Notes:**
_____________________________________________________________________________
_____________________________________________________________________________
_____________________________________________________________________________

**Issues Found:**
_____________________________________________________________________________
_____________________________________________________________________________
_____________________________________________________________________________
