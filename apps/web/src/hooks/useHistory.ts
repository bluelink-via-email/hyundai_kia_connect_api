import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

export interface HistoryEntry {
  id: string
  vehicle_id: string
  command: string
  result: 'success' | 'failed' | 'pending'
  created_at: string
}

export function useHistory() {
  return useQuery({
    queryKey: ['history'],
    queryFn: async () => {
      const response = await apiClient.get('/history')
      return response as HistoryEntry[]
    },
    refetchInterval: 30000, // 30 seconds
  })
}
