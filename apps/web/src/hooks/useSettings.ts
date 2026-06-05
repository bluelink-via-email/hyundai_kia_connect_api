import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

export interface Settings {
  default_temp_f: number
  default_duration: number
  defrost_default: boolean
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await apiClient.get('/settings')
      return response as Settings
    },
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<Settings>) => {
      const response = await apiClient.put('/settings', data)
      return response as Settings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}
