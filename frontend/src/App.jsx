import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Bills from './pages/Bills'
import Charges from './pages/Charges'

export default function App() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('bills')

  if (!user) return <Login />
  return activeTab === 'bills'
    ? <Bills onTabChange={setActiveTab} />
    : <Charges onTabChange={setActiveTab} />
}
