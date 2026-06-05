import { Lock, Unlock, Zap, Power } from 'lucide-react'
import { Vehicle, VehicleStatus } from '../hooks/useVehicles'
import clsx from 'clsx'

interface VehicleCardProps {
  vehicle: Vehicle
  status: VehicleStatus | undefined
  isLoading: boolean
  onLock: () => void
  onUnlock: () => void
  onStart: () => void
  onStop: () => void
}

const BRAND_NAMES: Record<number, string> = {
  1: 'Kia',
  2: 'Hyundai',
  3: 'Genesis',
}

export function VehicleCard({
  vehicle,
  status,
  isLoading,
  onLock,
  onUnlock,
  onStart,
  onStop,
}: VehicleCardProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">{vehicle.nickname}</h3>
          <p className="text-sm text-slate-400">
            {BRAND_NAMES[vehicle.brand] || 'Unknown'}
          </p>
        </div>
        {vehicle.is_default && (
          <span className="px-2 py-1 bg-blue-600 text-slate-50 text-xs font-medium rounded">
            Default
          </span>
        )}
      </div>

      {status ? (
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Status:</span>
            <span className="text-slate-50 font-medium">
              {status.locked ? (
                <span className="flex items-center gap-1">
                  <Lock className="w-4 h-4 text-blue-500" />
                  Locked
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Unlock className="w-4 h-4 text-yellow-500" />
                  Unlocked
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Engine:</span>
            <span
              className={clsx(
                'font-medium',
                status.engine_running
                  ? 'text-green-500 flex items-center gap-1'
                  : 'text-slate-300'
              )}
            >
              {status.engine_running ? (
                <>
                  <Power className="w-4 h-4" />
                  Running
                </>
              ) : (
                'Off'
              )}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Battery:</span>
            <span className="text-slate-50 font-medium flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              {status.battery_percent}%
            </span>
          </div>

          {status.climate_running && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Climate:</span>
              <span className="text-slate-50 font-medium">
                {status.climate_temp}°F
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-slate-400 text-sm mb-4">Loading status...</div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onLock}
          disabled={isLoading}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-slate-50 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-medium"
        >
          <Lock className="w-4 h-4" />
          Lock
        </button>
        <button
          onClick={onUnlock}
          disabled={isLoading}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-slate-50 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-medium"
        >
          <Unlock className="w-4 h-4" />
          Unlock
        </button>
        <button
          onClick={onStart}
          disabled={isLoading}
          className="px-3 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-700 disabled:text-slate-500 text-slate-50 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-medium"
        >
          <Power className="w-4 h-4" />
          Start
        </button>
        <button
          onClick={onStop}
          disabled={isLoading}
          className="px-3 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-700 disabled:text-slate-500 text-slate-50 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-medium"
        >
          <Power className="w-4 h-4" />
          Stop
        </button>
      </div>
    </div>
  )
}
