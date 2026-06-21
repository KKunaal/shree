import { useAuth } from '../context/AuthContext'

export default function Header({ onRefresh }) {
  const { user, logout } = useAuth()

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
          <button
            onClick={logout}
            className="text-xs bg-blue-600 hover:bg-blue-900 px-3 py-1.5 rounded-lg transition border border-blue-500"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
