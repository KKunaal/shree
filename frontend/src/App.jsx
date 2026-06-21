import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Bills from './pages/Bills'
import Charges from './pages/Charges'

export default function App() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')

  if (!user) return <Login />
  if (activeTab === 'bills')     return <Bills     onTabChange={setActiveTab} />
  if (activeTab === 'charges')   return <Charges   onTabChange={setActiveTab} />
  return                                <Dashboard onTabChange={setActiveTab} />
}
