import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSignIn } from '../hooks/useAuth'
import { Car } from 'lucide-react'

export function SignIn() {
  const navigate = useNavigate()
  const { mutate: signIn, isPending, error } = useSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    signIn(
      { email, password },
      {
        onSuccess: () => {
          navigate('/dashboard')
        },
      }
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
          <div className="flex items-center justify-center gap-2 mb-8">
            <Car className="w-8 h-8 text-blue-500" />
            <h1 className="text-2xl font-bold text-slate-50">AutoControl</h1>
          </div>

          <h2 className="text-xl font-semibold text-slate-50 mb-6">Sign In</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-600/10 border border-red-600/50 rounded-lg text-red-400 text-sm">
              {error instanceof Error ? error.message : 'Sign in failed'}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-slate-50 font-medium rounded-lg transition-colors"
            >
              {isPending ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-6">
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/signup')}
              className="text-blue-500 hover:text-blue-400 font-medium transition-colors"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
