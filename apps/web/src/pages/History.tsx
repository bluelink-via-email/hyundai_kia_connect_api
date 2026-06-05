import { useHistory } from '../hooks/useHistory'
import { Layout } from '../components/Layout'
import { CheckCircle, XCircle, Clock } from 'lucide-react'

export function History() {
  const { data: history, isLoading } = useHistory()

  if (isLoading) {
    return (
      <Layout>
        <div className="text-slate-400">Loading history...</div>
      </Layout>
    )
  }

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-50 mb-2">Command History</h1>
          <p className="text-slate-400">
            View all commands sent to your vehicles
          </p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          {!history || history.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No command history yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900">
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Vehicle
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Command
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {history.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                        {entry.vehicle_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-50">
                        {entry.command}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          {getResultIcon(entry.result)}
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
