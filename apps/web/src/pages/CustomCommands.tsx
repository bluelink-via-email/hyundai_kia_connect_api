import { useState } from 'react'
import { useCustomCommands, useCreateCustomCommand, useDeleteCustomCommand } from '../hooks/useCustomCommands'
import { Layout } from '../components/Layout'
import { Trash2, Plus } from 'lucide-react'

export function CustomCommands() {
  const { data: commands, isLoading } = useCustomCommands()
  const { mutate: createCommand, isPending: createPending } = useCreateCustomCommand()
  const { mutate: deleteCommand, isPending: deletePending } = useDeleteCustomCommand()

  const [showForm, setShowForm] = useState(false)
  const [alias, setAlias] = useState('')
  const [command, setCommand] = useState('')

  const AVAILABLE_COMMANDS = [
    'lock',
    'unlock',
    'start',
    'stop',
    'charge-start',
    'charge-stop',
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createCommand(
      { alias, command },
      {
        onSuccess: () => {
          setAlias('')
          setCommand('')
          setShowForm(false)
        },
      }
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="text-slate-400">Loading custom commands...</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-50 mb-2">
              Custom Commands
            </h1>
            <p className="text-slate-400">Create shortcuts for common commands</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-slate-50 rounded-lg font-medium"
          >
            <Plus className="w-4 h-4" />
            New Command
          </button>
        </div>

        {showForm && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-50 mb-4">
              Create Custom Command
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Command Alias
                </label>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="e.g., morning-prep"
                />
                <p className="text-xs text-slate-500 mt-1">
                  A short name for this command
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Command
                </label>
                <select
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="">Select a command</option>
                  {AVAILABLE_COMMANDS.map((cmd) => (
                    <option key={cmd} value={cmd}>
                      {cmd}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  The command to execute when you use this alias
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createPending}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-slate-50 font-medium rounded-lg transition-colors"
                >
                  {createPending ? 'Creating...' : 'Create Command'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-50 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {!commands || commands.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
            <p className="text-slate-400 mb-4">No custom commands yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-slate-50 rounded-lg font-medium"
            >
              Create Your First Command
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {commands.map((cmd) => (
              <div
                key={cmd.id}
                className="bg-slate-800 border border-slate-700 rounded-lg p-6 flex items-center justify-between"
              >
                <div>
                  <h3 className="text-lg font-semibold text-slate-50">
                    {cmd.alias}
                  </h3>
                  <p className="text-slate-400 text-sm">
                    Command: <span className="font-mono">{cmd.command}</span>
                  </p>
                </div>

                <button
                  onClick={() => deleteCommand(cmd.id)}
                  disabled={deletePending}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 text-slate-50 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
