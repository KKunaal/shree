import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Bills from './pages/Bills'
import Charges from './pages/Charges'
import Queue from './pages/Queue'
import Configure from './pages/Configure'
import { useUrlState } from './hooks/useUrlState'

export default function App() {
  const { user } = useAuth()
  const isDoctor = user?.role === 'doctor'
  const [previousTab, setPreviousTab] = useState(null)

  // Reception lands on Queue; doctor lands on Dashboard — persisted in URL (?tab=)
  const [activeTab, setActiveTab] = useUrlState('tab', isDoctor ? 'dashboard' : 'queue')

  if (!user) return <Login />

  // Reception is hard-blocked from dashboard and charges
  const safeSetTab = (tab) => {
    if (!isDoctor && (tab === 'dashboard' || tab === 'charges' || tab === 'usermanagement')) return
    // Store previous tab when navigating to user management
    if (tab === 'usermanagement' && activeTab !== 'usermanagement') {
      setPreviousTab(activeTab)
    }
    setActiveTab(tab)
  }

  const handleBackFromUserManagement = () => {
    setActiveTab(previousTab || (isDoctor ? 'dashboard' : 'queue'))
  }

  if (activeTab === 'queue')                     return <Queue     onTabChange={safeSetTab} />
  if (activeTab === 'bills')                     return <Bills     onTabChange={safeSetTab} />
  if (activeTab === 'charges' && isDoctor)       return <Charges   onTabChange={safeSetTab} />
  if (activeTab === 'dashboard' && isDoctor)     return <Dashboard onTabChange={safeSetTab} />
  if (activeTab === 'usermanagement' && isDoctor) return <Configure onTabChange={safeSetTab} onBack={handleBackFromUserManagement} isStandalone={true} />

  // Fallback
  return <Queue onTabChange={safeSetTab} />
}
