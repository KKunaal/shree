import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Header({ onRefresh, onNavigateToUserManagement }) {
  const { user, logout } = useAuth()
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const menuRef = useRef(null)
  const isDoctor = user?.role === 'doctor'

  // Close menu when clicking outside
  useEffect(() => {
    if (!showSettingsMenu) return
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowSettingsMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSettingsMenu])

  return (
    <header className="bg-blue-700 text-white shadow-md sticky top-0 z-40">
      <div className="max-w-2xl mx-auto px-4 h-[60px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl select-none">🏥</span>
          <div>
            <h1 className="font-bold text-base leading-tight">Shree Hospital</h1>
            <p className="text-blue-200 text-[10px]">Billing System</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-blue-200 hover:text-white p-2 rounded-lg hover:bg-blue-600 transition"
              title="Refresh bills"
            >
              🔄
            </button>
          )}
          <span className="text-xs text-blue-200 capitalize hidden sm:inline">{user?.username}</span>
          
          {/* Settings dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="text-blue-200 hover:text-white p-2 rounded-lg hover:bg-blue-600 transition"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </button>

            {showSettingsMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
                {isDoctor && onNavigateToUserManagement && (
                  <button
                    onClick={() => {
                      onNavigateToUserManagement()
                      setShowSettingsMenu(false)
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    User Management
                  </button>
                )}
                <button
                  onClick={() => {
                    logout()
                    setShowSettingsMenu(false)
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition flex items-center gap-2 border-t border-gray-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
