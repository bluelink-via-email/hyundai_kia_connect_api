import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

export interface CustomCommand {
  id: string
  alias: string
  command: string
}

export function useCustomCommands() {
  return useQuery({
    queryKey: ['custom-commands'],
    queryFn: async () => {
      const response = await apiClient.get('/custom-commands')
      return response as CustomCommand[]
    },
  })
}

export function useCreateCustomCommand() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { alias: string; command: string }) => {
      const response = await apiClient.post('/custom-commands', data)
      return response as CustomCommand
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-commands'] })
    },
  })
}

export function useDeleteCustomCommand() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/custom-commands/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-commands'] })
    },
  })
}
