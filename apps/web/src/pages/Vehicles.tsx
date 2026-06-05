import { useVehicles, useSetDefaultVehicle, useDeleteVehicle } from '../hooks/useVehicles'
import { Layout } from '../components/Layout'
import { useNavigate } from 'react-router-dom'
import { Trash2, Star, Edit } from 'lucide-react'

const BRAND_NAMES: Record<number, string> = {
  1: 'Kia',
  2: 'Hyundai',
  3: 'Genesis',
}

const REGION_NAMES: Record<number, string> = {
  1: 'Europe',
  2: 'Canada',
  3: 'USA',
  4: 'Australia',
  5: 'New Zealand',
  6: 'China',
  7: 'India',
  8: 'Brazil',
}

export function Vehicles() {
  const navigate = useNavigate()
  const { data: vehicles, isLoading } = useVehicles()
  const { mutate: setDefault, isPending: setDefaultPending } = useSetDefaultVehicle()
  const { mutate: deleteVehicle, isPending: deletePending } = useDeleteVehicle()

  if (isLoading) {
    return (
      <Layout>
        <div className="text-slate-400">Loading vehicles...</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-50 mb-2">Vehicles</h1>
            <p className="text-slate-400">Manage your connected vehicles</p>
          </div>
          <button
            onClick={() => navigate('/vehicles/add')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-slate-50 rounded-lg font-medium"
          >
            Add Vehicle
          </button>
        </div>

        {!vehicles || vehicles.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
            <p className="text-slate-400 mb-4">No vehicles added yet</p>
            <button
              onClick={() => navigate('/vehicles/add')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-slate-50 rounded-lg font-medium"
            >
              Add Your First Vehicle
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="bg-slate-800 border border-slate-700 rounded-lg p-6 flex items-center justify-between"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-50">
                    {vehicle.nickname}
                  </h3>
                  <p className="text-slate-400 text-sm">
                    {BRAND_NAMES[vehicle.brand]} • {REGION_NAMES[vehicle.region]} •{' '}
                    {vehicle.username}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {vehicle.is_default ? (
                    <span className="px-3 py-1 bg-blue-600 text-slate-50 text-xs font-medium rounded flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      Default
                    </span>
                  ) : (
                    <button
                      onClick={() => setDefault(vehicle.id)}
                      disabled={setDefaultPending}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded flex items-center gap-1 disabled:opacity-50"
                    >
                      <Star className="w-3 h-3" />
                      Set Default
                    </button>
                  )}

                  <button
                    onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-50 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>

                  <button
                    onClick={() => deleteVehicle(vehicle.id)}
                    disabled={deletePending}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 text-slate-50 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
