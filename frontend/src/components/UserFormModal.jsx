import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { createApiClient } from '../api'

export default function UserFormModal({ user, onClose, onSuccess }) {
  const { user: currentUser, logout } = useAuth()
  const isEdit = !!user
  const isEditingSelf = isEdit && user?.username === currentUser.username

  const [formData, setFormData] = useState({
    username: user?.username || '',
    current_password: '',
    password: '',
    role: user?.role || 'reception',
    is_active: user?.is_active ?? true,
  })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const api = createApiClient(currentUser.token)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    // If editing self and changing password, current password is required
    if (isEditingSelf && formData.password && !formData.current_password) {
      setError('Current password is required when changing your own password')
      return
    }

    setSubmitting(true)

    try {
      if (isEdit) {
        // Update existing user (role cannot be changed after creation)
        const updateData = {
          username: formData.username,
          is_active: formData.is_active,
        }
        
        // Only include password if it's been filled
        if (formData.password && formData.password.length >= 4) {
          updateData.password = formData.password
          
          // If changing own password, include current password for validation
          if (isEditingSelf) {
            updateData.current_password = formData.current_password
          }
        }
        
        await api.patch(`/users/${user.id}/`, updateData)
        
        // If user changed their own password, log them out
        if (isEditingSelf && formData.password) {
          alert('Your password has been changed! Please login with your new password.')
          logout()
        } else {
          onSuccess()
        }
      } else {
        // Create new user
        if (!formData.password || formData.password.length < 4) {
          setError('Password must be at least 4 characters')
          setSubmitting(false)
          return
        }
        await api.post('/users/', formData)
        onSuccess()
      }
    } catch (err) {
      setError(
        err.response?.data?.username?.[0] ||
        err.response?.data?.detail ||
        err.response?.data?.password?.[0] ||
        err.response?.data?.current_password?.[0] ||
        'Failed to save user'
      )
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">
          {isEdit ? 'Edit User' : 'Create New User'}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
              required
              disabled={isEditingSelf}
            />
            {isEditingSelf && (
              <p className="mt-1 text-xs text-gray-500">
                You cannot change your own username
              </p>
            )}
          </div>

          {isEdit && !isEditingSelf && (
            <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
              <div className="flex items-center mb-2">
                <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-semibold text-yellow-800">Current Password</span>
              </div>
              {user?.plain_password ? (
                <>
                  <div className="text-base font-mono font-semibold text-gray-900 bg-white px-4 py-3 rounded-md border border-yellow-300 select-all">
                    {user.plain_password}
                  </div>
                  <p className="mt-2 text-xs text-yellow-700">
                    💡 You can see and copy this password. Leave "New Password" blank to keep it unchanged.
                  </p>
                </>
              ) : (
                <>
                  <div className="text-sm text-gray-700 bg-white px-4 py-3 rounded-md border border-yellow-300 italic">
                    Password not available (created before password tracking)
                  </div>
                  <p className="mt-2 text-xs text-yellow-700">
                    💡 Set a new password below, and it will be stored for future reference.
                  </p>
                </>
              )}
            </div>
          )}

          {isEditingSelf && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
              💡 To change your password, you must enter your current password first.
            </div>
          )}

          {isEditingSelf && (
            <div>
              <label htmlFor="current_password" className="block text-sm font-medium text-gray-700 mb-1">
                Current Password {formData.password && <span className="text-red-500">*</span>}
              </label>
              <input
                id="current_password"
                type="text"
                value={formData.current_password}
                onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                placeholder="Required if changing password"
                required={!!formData.password}
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter your current password to change it
              </p>
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              {isEdit ? 'New Password' : 'Password'}
              {!isEdit && <span className="text-red-500"> *</span>}
              {isEdit && <span className="text-gray-500 font-normal"> (leave blank to keep current)</span>}
            </label>
            <input
              id="password"
              type="text"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              required={!isEdit}
              minLength={4}
              placeholder={isEdit ? 'Leave blank to keep current password' : 'Minimum 4 characters'}
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            {isEdit ? (
              // When editing: Show role as read-only text
              <>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                  <span className={`px-2 py-1 inline-flex text-sm font-semibold rounded-full ${
                    formData.role === 'doctor' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {formData.role === 'doctor' ? 'Doctor' : 'Reception'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Role cannot be changed after user creation
                </p>
              </>
            ) : (
              // When creating: Allow role selection
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="reception">Reception</option>
                <option value="doctor">Doctor</option>
              </select>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isEditingSelf}
            />
            <label htmlFor="is_active" className={`ml-2 block text-sm ${isEditingSelf ? 'text-gray-500' : 'text-gray-700'}`}>
              Active
            </label>
            {isEditingSelf && (
              <span className="ml-2 text-xs text-gray-500">
                (You cannot deactivate your own account)
              </span>
            )}
          </div>

          {isEditingSelf && formData.password && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              ⚠️ You will be logged out after changing your password and will need to login again.
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : (isEdit ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
