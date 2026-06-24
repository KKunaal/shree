-- Emergency script to reactivate all doctor accounts
-- Run this directly in SQLite if you can't access Django management commands

-- Show current status
SELECT username, role, is_active, 'BEFORE' as status FROM billing_user WHERE role = 'doctor';

-- Reactivate all doctor accounts
UPDATE billing_user SET is_active = 1 WHERE role = 'doctor';

-- Show updated status
SELECT username, role, is_active, 'AFTER' as status FROM billing_user WHERE role = 'doctor';
