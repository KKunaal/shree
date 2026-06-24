import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { createApiClient } from '../api'
import Header from '../components/Header'
import UserFormModal from '../components/UserFormModal'
import ChangePasswordModal from '../components/ChangePasswordModal'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Configure({ onTabChange, onBack, isStandalone = false }) {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [changingPasswordFor, setChangingPasswordFor] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, userId: null, username: '' })
  const activeTabRef = useRef(null)

  const api = createApiClient(user.token)
  const isDoctor = user?.role === 'doctor'

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get('/users/')
      setUsers(response.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    // Scroll active tab into view only on mobile screens where it might be hidden
    const isMobileView = window.innerWidth < 640 // sm breakpoint
    if (isMobileView && activeTabRef.current) {
      // Small delay to ensure DOM is ready and prevent jarring effect
      setTimeout(() => {
        activeTabRef.current?.scrollIntoView({
          behavior: 'auto', // Instant scroll instead of smooth to avoid jarring animation
          block: 'nearest',
          inline: 'end' // Scroll just enough to show the tab, not center it
        })
      }, 100)
    }
  }, [])

  useEffect(() => {
    // Close menu on outside click
    if (!openMenuId) return
    const handleClick = () => setOpenMenuId(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openMenuId])

  const handleDelete = async (userId) => {
    try {
      await api.delete(`/users/${userId}/`)
      setUsers(users.filter(u => u.id !== userId))
      setOpenMenuId(null)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete user')
    }
  }

  const openDeleteConfirm = (userId, username) => {
    setDeleteConfirm({ isOpen: true, userId, username })
    setOpenMenuId(null)
  }

  const handleToggleActive = async (userId, currentStatus) => {
    try {
      await api.patch(`/users/${userId}/`, { is_active: !currentStatus })
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: !currentStatus } : u))
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update user status')
    }
  }

  const toggleMenu = (e, userId) => {
    e.stopPropagation()
    setOpenMenuId(openMenuId === userId ? null : userId)
  }

  const isCurrentUser = (username) => username === user.username
  
  const canEditUser = (targetUser) => {
    // Can edit self
    if (targetUser.username === user.username) return true
    // Cannot edit other doctors
    if (targetUser.role === 'doctor') return false
    // Can edit reception users
    return true
  }
  
  const canDeleteUser = (targetUser) => {
    // Cannot delete self
    if (targetUser.username === user.username) return false
    // Cannot delete other doctors
    if (targetUser.role === 'doctor') return false
    // Can delete reception users
    return true
  }
  
  const showActionsMenu = (targetUser) => {
    // Show menu if user can edit OR delete
    return canEditUser(targetUser) || canDeleteUser(targetUser)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onNavigateToUserManagement={isStandalone ? null : () => onTabChange('usermanagement')} />
      
      {/* Back button when in standalone mode */}
      {isStandalone && onBack && (
        <div className="bg-white border-b">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>
        </div>
      )}
      
      {/* Only show tabs when NOT in standalone mode */}
      {!isStandalone && (
        <div className="bg-white border-b sticky top-[60px] z-30">
          <div className="max-w-2xl mx-auto overflow-x-auto no-scrollbar">
            <div className="flex min-w-max">
              {isDoctor && (
                <button onClick={() => onTabChange('dashboard')}
                  className="px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition whitespace-nowrap">
                  📊 Dashboard
                </button>
              )}
              <button onClick={() => onTabChange('bills')}
                className="px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition whitespace-nowrap">
                📋 Bills
              </button>
              <button onClick={() => onTabChange('queue')}
                className="px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition whitespace-nowrap">
                🏥 Queue
              </button>
              {isDoctor && (
                <button onClick={() => onTabChange('charges')}
                  className="px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition whitespace-nowrap">
                  ⚙️ Charges
                </button>
              )}
              {isDoctor && (
                <button 
                  ref={activeTabRef}
                  className="px-4 py-3 text-sm font-semibold text-blue-700 border-b-2 border-blue-700 whitespace-nowrap">
                  👤 Configure
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">User Management</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + Create User
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading users...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Username
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                      
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((u, index) => {
                    const isSelf = isCurrentUser(u.username)
                    const isMenuOpen = openMenuId === u.id
                    const isLastUser = index === users.length - 1
                    return (
                      <tr key={u.id} className={u.is_active ? '' : 'bg-gray-50'}>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900">
                              {u.username}
                              {isSelf && (
                                <span className="ml-2 text-xs text-gray-500 font-normal">(You)</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            u.role === 'doctor' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            u.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex justify-end items-center h-full relative">
                            {showActionsMenu(u) && (
                              <button
                                onClick={(e) => toggleMenu(e, u.id)}
                                className="inline-flex items-center justify-center text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition"
                                aria-label="User actions"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                                </svg>
                              </button>
                            )}
                            
                            {isMenuOpen && (
                              <div 
                                className={`absolute right-0 w-48 bg-white rounded-lg shadow-xl border border-gray-200 ${
                                  isLastUser ? 'bottom-full mb-2' : 'top-full mt-2'
                                }`}
                                style={{ zIndex: 9999 }}
                              >
                                  <div className="py-1">
                                    {canEditUser(u) && (
                                      <button
                                        onClick={() => {
                                          setEditingUser(u)
                                          setOpenMenuId(null)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition flex items-center"
                                      >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Edit User
                                      </button>
                                    )}
                                    {canDeleteUser(u) && (
                                      <button
                                        onClick={() => {
                                          openDeleteConfirm(u.id, u.username)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition flex items-center"
                                      >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Delete User
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {users.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No users found. Create one to get started.
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <UserFormModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            fetchUsers()
          }}
        />
      )}

      {editingUser && (
        <UserFormModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null)
            fetchUsers()
          }}
        />
      )}

      {changingPasswordFor && (
        <ChangePasswordModal
          user={changingPasswordFor}
          onClose={() => setChangingPasswordFor(null)}
          onSuccess={() => setChangingPasswordFor(null)}
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, userId: null, username: '' })}
        onConfirm={() => handleDelete(deleteConfirm.userId)}
        title="Delete User"
        message={`Are you sure you want to delete user "${deleteConfirm.username}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDanger={true}
      />
    </div>
  )
}
