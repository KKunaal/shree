import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Bills from './pages/Bills'
import Charges from './pages/Charges'
import Queue from './pages/Queue'

export default function App() {
  const { user } = useAuth()
  const isDoctor = user?.role === 'doctor'

  // Reception lands on Queue; doctor lands on Dashboard
  const [activeTab, setActiveTab] = useState(() => isDoctor ? 'dashboard' : 'queue')

  if (!user) return <Login />

  // Reception is hard-blocked from dashboard and charges
  const safeSetTab = (tab) => {
    if (!isDoctor && (tab === 'dashboard' || tab === 'charges')) return
    setActiveTab(tab)
  }

  if (activeTab === 'queue')                 return <Queue     onTabChange={safeSetTab} />
  if (activeTab === 'bills')                 return <Bills     onTabChange={safeSetTab} />
  if (activeTab === 'charges' && isDoctor)   return <Charges   onTabChange={safeSetTab} />
  if (activeTab === 'dashboard' && isDoctor) return <Dashboard onTabChange={safeSetTab} />

  // Fallback
  return <Queue onTabChange={safeSetTab} />
}
