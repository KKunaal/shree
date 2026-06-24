# User Management API Quick Reference

## Authentication

All endpoints require Basic Authentication header:
```
Authorization: Basic <base64(username:password)>
```

## Endpoints

### 1. List Users
```http
GET /api/users/
```

**Authorization:** Doctor only

**Response:**
```json
[
  {
    "id": 1,
    "username": "doctor",
    "role": "doctor",
    "is_active": true,
    "created_at": "2026-06-24T10:00:00Z",
    "updated_at": "2026-06-24T10:00:00Z"
  },
  {
    "id": 2,
    "username": "reception",
    "role": "reception",
    "is_active": true,
    "created_at": "2026-06-24T10:00:00Z",
    "updated_at": "2026-06-24T10:00:00Z"
  }
]
```

### 2. Create User
```http
POST /api/users/
Content-Type: application/json
```

**Authorization:** Doctor only

**Request Body:**
```json
{
  "username": "newuser",
  "password": "password123",
  "role": "reception",
  "is_active": true
}
```

**Response:** (201 Created)
```json
{
  "id": 3,
  "username": "newuser",
  "role": "reception",
  "is_active": true
}
```

**Errors:**
- `400 Bad Request` - Validation error (duplicate username, password too short, etc.)
- `403 Forbidden` - Not a doctor

### 3. Get User Details
```http
GET /api/users/{id}/
```

**Authorization:** Doctor only

**Response:**
```json
{
  "id": 1,
  "username": "doctor",
  "role": "doctor",
  "is_active": true,
  "created_at": "2026-06-24T10:00:00Z",
  "updated_at": "2026-06-24T10:00:00Z"
}
```

### 4. Update User
```http
PATCH /api/users/{id}/
Content-Type: application/json
```

**Authorization:** Doctor only

**Request Body:** (all fields optional)
```json
{
  "username": "newusername",
  "role": "doctor",
  "is_active": false
}
```

**Response:**
```json
{
  "id": 3,
  "username": "newusername",
  "role": "doctor",
  "is_active": false
}
```

**Note:** Password cannot be updated through this endpoint. Use change-password endpoint instead.

### 5. Delete User
```http
DELETE /api/users/{id}/
```

**Authorization:** Doctor only

**Response:** (204 No Content)

### 6. Change Password
```http
POST /api/users/change-password/
Content-Type: application/json
```

**Authorization:** Any authenticated user

**Request Body (changing own password):**
```json
{
  "current_password": "oldpassword",
  "new_password": "newpassword"
}
```

**Request Body (doctor changing another user's password):**
```json
{
  "user_id": 2,
  "current_password": "oldpassword",
  "new_password": "newpassword"
}
```

**Response:** (200 OK)
```json
{
  "message": "Password changed successfully."
}
```

**Errors:**
- `400 Bad Request` - Current password incorrect, new password too short, etc.
- `403 Forbidden` - Non-doctor trying to change another user's password

## Error Responses

### Validation Error (400)
```json
{
  "username": ["A user with that username already exists."],
  "password": ["Ensure this field has at least 4 characters."]
}
```

### Authentication Error (401)
```json
{
  "detail": "Invalid username/password."
}
```

### Permission Error (403)
```json
{
  "detail": "Only doctors can perform this action."
}
```

### Not Found (404)
```json
{
  "detail": "Not found."
}
```

## Field Validations

### Username
- Required
- Unique
- Max 150 characters

### Password (create only)
- Required
- Minimum 4 characters
- Stored as hashed value

### Role
- Required
- Must be either "doctor" or "reception"

### is_active
- Boolean
- Default: true
- Inactive users cannot authenticate

## Examples

### cURL Examples

**List users:**
```bash
curl -X GET http://localhost:8000/api/users/ \
  -H "Authorization: Basic ZG9jdG9yOmRvY3RvckAxMjM="
```

**Create user:**
```bash
curl -X POST http://localhost:8000/api/users/ \
  -H "Authorization: Basic ZG9jdG9yOmRvY3RvckAxMjM=" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "nurse1",
    "password": "nurse@123",
    "role": "reception",
    "is_active": true
  }'
```

**Change password (own):**
```bash
curl -X POST http://localhost:8000/api/users/change-password/ \
  -H "Authorization: Basic ZG9jdG9yOmRvY3RvckAxMjM=" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "doctor@123",
    "new_password": "newpassword123"
  }'
```

**Change password (other user, as doctor):**
```bash
curl -X POST http://localhost:8000/api/users/change-password/ \
  -H "Authorization: Basic ZG9jdG9yOmRvY3RvckAxMjM=" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 2,
    "current_password": "reception@123",
    "new_password": "newpassword123"
  }'
```

**Update user:**
```bash
curl -X PATCH http://localhost:8000/api/users/2/ \
  -H "Authorization: Basic ZG9jdG9yOmRvY3RvckAxMjM=" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "doctor",
    "is_active": true
  }'
```

**Delete user:**
```bash
curl -X DELETE http://localhost:8000/api/users/2/ \
  -H "Authorization: Basic ZG9jdG9yOmRvY3RvckAxMjM="
```

### JavaScript/Axios Examples

**List users:**
```javascript
import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    Authorization: `Basic ${btoa('doctor:doctor@123')}`,
  }
})

const users = await api.get('/users/')
console.log(users.data)
```

**Create user:**
```javascript
const newUser = await api.post('/users/', {
  username: 'nurse1',
  password: 'nurse@123',
  role: 'reception',
  is_active: true
})
console.log(newUser.data)
```

**Change password:**
```javascript
// Own password
await api.post('/users/change-password/', {
  current_password: 'doctor@123',
  new_password: 'newpassword123'
})

// Other user's password (as doctor)
await api.post('/users/change-password/', {
  user_id: 2,
  current_password: 'reception@123',
  new_password: 'newpassword123'
})
```

## Notes

1. **Password Security:** All passwords are hashed using Django's PBKDF2 algorithm before storage
2. **Role Permissions:** Only doctors can access user management endpoints
3. **Password Changes:** When a user changes their own password, they should re-authenticate with the new password
4. **Active Status:** Setting `is_active` to `false` prevents the user from authenticating but doesn't delete the account
5. **Username Changes:** Once created, usernames cannot be changed (only through database)
