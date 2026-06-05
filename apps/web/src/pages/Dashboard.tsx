import { useVehicles, useVehicleStatus, useLockVehicle, useUnlockVehicle, useStartClimate, useStopClimate } from '../hooks/useVehicles'
import { useHistory } from '../hooks/useHistory'
import { VehicleCard } from '../components/VehicleCard'
import { Layout } from '../components/Layout'
import { useNavigate } from 'react-router-dom'

export function Dashboard() {
  const navigate = useNavigate()
  const { data: vehicles, isLoading: vehiclesLoading } = useVehicles()
  const defaultVehicle = vehicles?.find((v) => v.is_default)
  const { data: status } = useVehicleStatus(defaultVehicle?.id || '')
  const { data: history } = useHistory()

  const { mutate: lock, isPending: lockPending } = useLockVehicle()
  const { mutate: unlock, isPending: unlockPending } = useUnlockVehicle()
  const { mutate: start, isPending: startPending } = useStartClimate()
  const { mutate: stop, isPending: stopPending } = useStopClimate()

  const recentHistory = history?.slice(0, 5) || []

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 mb-2">Dashboard</h1>
          <p className="text-slate-400">Welcome to your vehicle control center</p>
        </div>

        {vehiclesLoading ? (
          <div className="text-slate-400">Loading vehicles...</div>
        ) : !defaultVehicle ? (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 text-center">
            <p className="text-slate-400 mb-4">No default vehicle set</p>
            <button
              onClick={() => navigate('/vehicles/add')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-slate-50 rounded-lg font-medium"
            >
              Add Vehicle
            </button>
          </div>
        ) : (
          <>
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <VehicleCard
                  vehicle={defaultVehicle}
                  status={status}
                  isLoading={lockPending || unlockPending || startPending || stopPending}
                  onLock={() => lock(defaultVehicle.id)}
                  onUnlock={() => unlock(defaultVehicle.id)}
                  onStart={() => start({ vehicleId: defaultVehicle.id })}
                  onStop={() => stop(defaultVehicle.id)}
                />
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-slate-50 mb-4">Quick Info</h2>
                <div className="space-y-3 text-sm">
                  {status && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Locked:</span>
                        <span className="text-slate-50 font-medium">
                          {status.locked ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Engine:</span>
                        <span className="text-slate-50 font-medium">
                          {status.engine_running ? 'Running' : 'Off'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Battery:</span>
                        <span className="text-slate-50 font-medium">
                          {status.battery_percent}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Odometer:</span>
                        <span className="text-slate-50 font-medium">
                          {status.odometer} km
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {recentHistory.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-slate-50 mb-4">
                  Recent Commands
                </h2>
                <div className="space-y-2">
                  {recentHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between text-sm text-slate-300 pb-2 border-b border-slate-700 last:border-0"
                    >
                      <div>
                        <span className="font-medium">{entry.command}</span>
                        <span className="text-slate-500 ml-2">
                          {new Date(entry.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <span
                        className={
                          entry.result === 'success'
                            ? 'text-green-500'
                            : entry.result === 'failed'
                              ? 'text-red-500'
                              : 'text-yellow-500'
                        }
                      >
                        {entry.result}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
