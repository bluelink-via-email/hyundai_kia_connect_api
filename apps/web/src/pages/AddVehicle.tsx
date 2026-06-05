import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAddVehicle } from '../hooks/useVehicles'
import { Layout } from '../components/Layout'
import { Eye, EyeOff } from 'lucide-react'

const BRANDS = [
  { id: 1, name: 'Kia' },
  { id: 2, name: 'Hyundai' },
  { id: 3, name: 'Genesis' },
]

const REGIONS = [
  { id: 1, name: 'Europe' },
  { id: 2, name: 'Canada' },
  { id: 3, name: 'USA' },
  { id: 4, name: 'Australia' },
  { id: 5, name: 'New Zealand' },
  { id: 6, name: 'China' },
  { id: 7, name: 'India' },
  { id: 8, name: 'Brazil' },
]

export function AddVehicle() {
  const navigate = useNavigate()
  const { mutate: addVehicle, isPending, error } = useAddVehicle()
  const [showPassword, setShowPassword] = useState(false)

  const [formData, setFormData] = useState({
    nickname: '',
    brand: 1,
    region: 3,
    username: '',
    password: '',
    pin: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addVehicle(
      {
        brand: formData.brand,
        region: formData.region,
        username: formData.username,
        password: formData.password,
        pin: formData.pin || undefined,
        nickname: formData.nickname,
      },
      {
        onSuccess: () => {
          navigate('/vehicles')
        },
      }
    )
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-50 mb-2">Add Vehicle</h1>
          <p className="text-slate-400">Connect a new Hyundai or Kia vehicle</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-600/10 border border-red-600/50 rounded-lg text-red-400 text-sm">
              {error instanceof Error ? error.message : 'Failed to add vehicle'}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Vehicle Nickname
              </label>
              <input
                type="text"
                value={formData.nickname}
                onChange={(e) =>
                  setFormData({ ...formData, nickname: e.target.value })
                }
                required
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="e.g., My Kia EV6"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Brand
                </label>
                <select
                  value={formData.brand}
                  onChange={(e) =>
                    setFormData({ ...formData, brand: Number(e.target.value) })
                  }
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:border-blue-500 transition-colors"
                >
                  {BRANDS.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Region
                </label>
                <select
                  value={formData.region}
                  onChange={(e) =>
                    setFormData({ ...formData, region: Number(e.target.value) })
                  }
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:border-blue-500 transition-colors"
                >
                  {REGIONS.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Vehicle Account Email/Username
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                required
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="your-vehicle-account@example.com"
              />
              <p className="text-xs text-slate-500 mt-1">
                This is the email/username for your Hyundai/Kia account
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Vehicle Account Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                PIN (Optional)
              </label>
              <input
                type="password"
                value={formData.pin}
                onChange={(e) =>
                  setFormData({ ...formData, pin: e.target.value })
                }
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="1234"
              />
              <p className="text-xs text-slate-500 mt-1">
                Optional PIN for additional security
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-slate-50 font-medium rounded-lg transition-colors"
              >
                {isPending ? 'Adding Vehicle...' : 'Add Vehicle'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/vehicles')}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-50 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}
