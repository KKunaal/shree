import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('shree_auth')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const login = (username, password) => {
    const role = username === 'doctor' ? 'doctor' : 'reception'
    const u = { username, password, token: btoa(`${username}:${password}`), role }
    setUser(u)
    localStorage.setItem('shree_auth', JSON.stringify(u))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('shree_auth')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
