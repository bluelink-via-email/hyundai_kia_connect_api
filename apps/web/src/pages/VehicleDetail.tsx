import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useVehicle, useUpdateVehicle, useVehicleStatus, useLockVehicle, useUnlockVehicle, useStartClimate, useStopClimate, useStartCharge, useStopCharge } from '../hooks/useVehicles'
import { Layout } from '../components/Layout'
import { CommandButton } from '../components/CommandButton'
import { Lock, Unlock, Thermometer, Power, Zap, ArrowLeft } from 'lucide-react'

const BRAND_NAMES: Record<number, string> = {
  1: 'Kia',
  2: 'Hyundai',
  3: 'Genesis',
}

export function VehicleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!id) return <div>Invalid vehicle</div>

  const { data: vehicle, isLoading: vehicleLoading } = useVehicle(id)
  const { data: status } = useVehicleStatus(id)
  const { mutate: updateVehicle, isPending: updatePending } = useUpdateVehicle()
  const { mutate: lock, isPending: lockPending } = useLockVehicle()
  const { mutate: unlock, isPending: unlockPending } = useUnlockVehicle()
  const { mutate: start, isPending: startPending } = useStartClimate()
  const { mutate: stop, isPending: stopPending } = useStopClimate()
  const { mutate: startCharge, isPending: startChargePending } = useStartCharge()
  const { mutate: stopCharge, isPending: stopChargePending } = useStopCharge()

  const [editMode, setEditMode] = useState(false)
  const [nickname, setNickname] = useState(vehicle?.nickname || '')
  const [temp, setTemp] = useState(72)
  const [duration, setDuration] = useState(10)
  const [defrost, setDefrost] = useState(false)

  if (vehicleLoading) {
    return (
      <Layout>
        <div className="text-slate-400">Loading vehicle...</div>
      </Layout>
    )
  }

  if (!vehicle) {
    return (
      <Layout>
        <div className="text-slate-400">Vehicle not found</div>
      </Layout>
    )
  }

  const handleUpdateNickname = () => {
    updateVehicle({ id, nickname }, { onSuccess: () => setEditMode(false) })
  }

  const isPending =
    lockPending ||
    unlockPending ||
    startPending ||
    stopPending ||
    startChargePending ||
    stopChargePending

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <button
          onClick={() => navigate('/vehicles')}
          className="flex items-center gap-2 text-blue-500 hover:text-blue-400 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Vehicles
        </button>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              {editMode ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleUpdateNickname}
                    disabled={updatePending}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-slate-50 rounded-lg font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(false)
                      setNickname(vehicle.nickname)
                    }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-50 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <h1 className="text-3xl font-bold text-slate-50 mb-2">
                    {vehicle.nickname}
                  </h1>
                  <p className="text-slate-400">
                    {BRAND_NAMES[vehicle.brand]} • {vehicle.username}
                  </p>
                  <button
                    onClick={() => setEditMode(true)}
                    className="mt-2 text-blue-500 hover:text-blue-400 text-sm font-medium"
                  >
                    Edit nickname
                  </button>
                </div>
              )}
            </div>
            {vehicle.is_default && (
              <span className="px-3 py-1 bg-blue-600 text-slate-50 text-sm font-medium rounded">
                Default
              </span>
            )}
          </div>

          {status && (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-4">
                  Vehicle Status
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Locked:</span>
                    <span className="text-slate-50 font-medium">
                      {status.locked ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Engine:</span>
                    <span className="text-slate-50 font-medium">
                      {status.engine_running ? 'Running' : 'Off'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Battery:</span>
                    <span className="text-slate-50 font-medium">
                      {status.battery_percent}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Charging:</span>
                    <span className="text-slate-50 font-medium">
                      {status.charging ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Climate:</span>
                    <span className="text-slate-50 font-medium">
                      {status.climate_running
                        ? `${status.climate_temp}°F`
                        : 'Off'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Odometer:</span>
                    <span className="text-slate-50 font-medium">
                      {status.odometer} km
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-4">
                  Climate Controls
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">
                      Temperature: {temp}°F
                    </label>
                    <input
                      type="range"
                      min="62"
                      max="82"
                      value={temp}
                      onChange={(e) => setTemp(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">
                      Duration: {duration} min
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="30"
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={defrost}
                      onChange={(e) => setDefrost(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-slate-300">Enable defrost</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">
              Lock Controls
            </h3>
            <div className="flex gap-3">
              <CommandButton
                icon={Lock}
                label="Lock"
                onClick={() => lock(id)}
                disabled={isPending}
              />
              <CommandButton
                icon={Unlock}
                label="Unlock"
                onClick={() => unlock(id)}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">
              Climate Controls
            </h3>
            <div className="flex gap-3">
              <CommandButton
                icon={Thermometer}
                label="Start Climate"
                onClick={() =>
                  start({
                    vehicleId: id,
                    temp,
                    duration,
                    defrost,
                  })
                }
                disabled={isPending}
              />
              <CommandButton
                icon={Power}
                label="Stop Climate"
                onClick={() => stop(id)}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">
              Charging Controls
            </h3>
            <div className="flex gap-3">
              <CommandButton
                icon={Zap}
                label="Start Charge"
                onClick={() => startCharge(id)}
                disabled={isPending}
              />
              <CommandButton
                icon={Zap}
                label="Stop Charge"
                onClick={() => stopCharge(id)}
                disabled={isPending}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
