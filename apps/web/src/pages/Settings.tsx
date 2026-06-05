import { useState } from 'react'
import { useSettings, useUpdateSettings } from '../hooks/useSettings'
import { Layout } from '../components/Layout'
import { useStore } from '../lib/store'

export function Settings() {
  const { user } = useStore()
  const { data: settings, isLoading } = useSettings()
  const { mutate: updateSettings, isPending } = useUpdateSettings()

  const [tempF, setTempF] = useState(settings?.default_temp_f || 72)
  const [duration, setDuration] = useState(settings?.default_duration || 10)
  const [defrost, setDefrost] = useState(settings?.defrost_default || false)

  // Update form when settings load
  if (settings && tempF === 72 && settings.default_temp_f !== 72) {
    setTempF(settings.default_temp_f)
    setDuration(settings.default_duration)
    setDefrost(settings.defrost_default)
  }

  const handleSave = () => {
    updateSettings({
      default_temp_f: tempF,
      default_duration: duration,
      defrost_default: defrost,
    })
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="text-slate-400">Loading settings...</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 mb-2">Settings</h1>
          <p className="text-slate-400">Manage your account and preferences</p>
        </div>

        <div className="space-y-6">
          {/* Account Section */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-50 mb-4">Account</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Email Address
                </label>
                <p className="text-slate-50 font-medium">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Default Settings Section */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-50 mb-4">
              Default Climate Settings
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Default Temperature: {tempF}°F
                </label>
                <input
                  type="range"
                  min="62"
                  max="82"
                  value={tempF}
                  onChange={(e) => setTempF(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Default temperature for climate control (62-82°F)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Default Duration: {duration} minutes
                </label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Default duration for climate control (1-30 minutes)
                </p>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={defrost}
                  onChange={(e) => setDefrost(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-slate-300">
                  Enable defrost by default
                </span>
              </label>

              <button
                onClick={handleSave}
                disabled={isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-slate-50 font-medium rounded-lg transition-colors"
              >
                {isPending ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>

          {/* Email Commands Section */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-50 mb-4">
              Email Commands
            </h2>
            <div className="space-y-3 text-sm">
              <p className="text-slate-400">
                You can control your vehicles via email by sending commands to:
              </p>
              <div className="bg-slate-900 border border-slate-700 rounded p-3">
                <p className="text-slate-50 font-mono text-center">
                  {user?.email}
                </p>
              </div>
              <p className="text-slate-400">
                Use commands like "lock", "unlock", "start climate", "stop climate",
                "start charge", or "stop charge" in the email subject line.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
