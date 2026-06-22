import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Bills from './pages/Bills'
import Charges from './pages/Charges'

export default function App() {
  const { user } = useAuth()
  const isDoctor = user?.role === 'doctor'

  // Reception lands on Bills; doctor lands on Dashboard
  const [activeTab, setActiveTab] = useState(() => isDoctor ? 'dashboard' : 'bills')

  if (!user) return <Login />

  // Reception is hard-blocked from dashboard and charges
  const safeSetTab = (tab) => {
    if (!isDoctor && (tab === 'dashboard' || tab === 'charges')) return
    setActiveTab(tab)
  }

  if (activeTab === 'bills')                 return <Bills     onTabChange={safeSetTab} />
  if (activeTab === 'charges' && isDoctor)   return <Charges   onTabChange={safeSetTab} />
  if (activeTab === 'dashboard' && isDoctor) return <Dashboard onTabChange={safeSetTab} />

  // Fallback (shouldn't reach here, but safety net)
  return <Bills onTabChange={safeSetTab} />
}
