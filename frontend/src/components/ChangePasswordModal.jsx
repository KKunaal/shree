import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { createApiClient } from '../api'

export default function ChangePasswordModal({ user: targetUser, onClose, onSuccess }) {
  const { user: currentUser, logout } = useAuth()
  const isOwnPassword = !targetUser || targetUser.username === currentUser.username

  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const api = createApiClient(currentUser.token)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    // For self password change, current password is mandatory
    if (isOwnPassword && !formData.current_password) {
      setError('Current password is required')
      return
    }

    // Validate passwords match
    if (formData.new_password !== formData.confirm_password) {
      setError('New passwords do not match')
      return
    }

    // Validate password length
    if (formData.new_password.length < 4) {
      setError('New password must be at least 4 characters')
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        current_password: formData.current_password,
        new_password: formData.new_password,
      }

      // If changing another user's password, include user_id
      if (!isOwnPassword && targetUser) {
        payload.user_id = targetUser.id
      }

      await api.post('/users/change-password/', payload)
      
      // If user changed their own password, log them out
      if (isOwnPassword) {
        alert('Password changed successfully! Please login with your new password.')
        logout()
      } else {
        alert('Password changed successfully!')
        onSuccess()
      }
    } catch (err) {
      const errorMsg = err.response?.data?.non_field_errors?.[0] ||
                      err.response?.data?.detail ||
                      err.response?.data?.current_password?.[0] ||
                      err.response?.data?.new_password?.[0] ||
                      'Failed to change password'
      setError(errorMsg)
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">
          Change Password
          {!isOwnPassword && targetUser && (
            <span className="text-lg font-normal text-gray-600"> for {targetUser.username}</span>
          )}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Password {isOwnPassword && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={formData.current_password}
              onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              required={isOwnPassword}
              autoFocus
              placeholder={isOwnPassword ? "Enter your current password" : "Enter current password"}
            />
            <p className="mt-1 text-xs text-gray-500">
              {isOwnPassword 
                ? 'You must enter your current password to proceed' 
                : `Enter the current password for ${targetUser?.username || 'this user'}`
              }
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.new_password}
              onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              required
              minLength={4}
              placeholder="Enter new password (min 4 characters)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.confirm_password}
              onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              required
              minLength={4}
              placeholder="Re-enter new password"
            />
          </div>

          {isOwnPassword && (
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
              {submitting ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
