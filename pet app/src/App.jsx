import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import PetsPage from './pages/PetsPage'
import PetDetailPage from './pages/PetDetailPage'
import ExpensesPage from './pages/ExpensesPage'
import ExpenseReportPage from './pages/ExpenseReportPage'
import HealthConsultPage from './pages/HealthConsultPage'
import DietPage from './pages/DietPage'
import FoodDatabasePage from './pages/FoodDatabasePage' 

function PrivateRoute({ children }) {
  const token = useAuthStore(s => s.token)
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="pets"      element={<PetsPage />} />
        <Route path="pets/:id"  element={<PetDetailPage />} />
        <Route path="expenses"       element={<ExpensesPage />} />
        <Route path="expense-report" element={<ExpenseReportPage />} />
        <Route path="health-consult" element={<HealthConsultPage />} />
        <Route path="diet" element={<DietPage />} />
        <Route path="food-database" element={<FoodDatabasePage />} />
      </Route>
    </Routes>
  )
} 