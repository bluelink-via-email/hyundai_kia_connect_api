import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './lib/store'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'

// Pages
import { SignIn } from './pages/SignIn'
import { SignUp } from './pages/SignUp'
import { Dashboard } from './pages/Dashboard'
import { Vehicles } from './pages/Vehicles'
import { AddVehicle } from './pages/AddVehicle'
import { VehicleDetail } from './pages/VehicleDetail'
import { History } from './pages/History'
import { Settings } from './pages/Settings'
import { CustomCommands } from './pages/CustomCommands'

function App() {
  const { sessionId } = useStore()

  return (
    <Routes>
      {/* Auth Routes */}
      <Route
        path="/signin"
        element={sessionId ? <Navigate to="/dashboard" replace /> : <SignIn />}
      />
      <Route
        path="/signup"
        element={sessionId ? <Navigate to="/dashboard" replace /> : <SignUp />}
      />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vehicles"
        element={
          <ProtectedRoute>
            <Vehicles />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vehicles/add"
        element={
          <ProtectedRoute>
            <AddVehicle />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vehicles/:id"
        element={
          <ProtectedRoute>
            <VehicleDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <History />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/custom-commands"
        element={
          <ProtectedRoute>
            <CustomCommands />
          </ProtectedRoute>
        }
      />

      {/* Default redirect */}
      <Route
        path="/"
        element={
          sessionId ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/signin" replace />
          )
        }
      />

      {/* 404 Fallback */}
      <Route
        path="*"
        element={
          <Layout>
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-slate-50 mb-2">404</h1>
                <p className="text-slate-400 mb-4">Page not found</p>
                <a
                  href="/"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-slate-50 rounded-lg font-medium"
                >
                  Go to home
                </a>
              </div>
            </div>
          </Layout>
        }
      />
    </Routes>
  )
}

export default App
