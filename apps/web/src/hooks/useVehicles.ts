import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

export interface Vehicle {
  id: string
  brand: number
  region: number
  nickname: string
  is_default: boolean
  username: string
}

export interface VehicleStatus {
  locked: boolean
  engine_running: boolean
  battery_percent: number
  charging: boolean
  climate_temp: number | null
  climate_running: boolean
  odometer: number
}

export function useVehicles() {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const response = await apiClient.get('/vehicles')
      return response as Vehicle[]
    },
  })
}

export function useVehicle(id: string) {
  return useQuery({
    queryKey: ['vehicles', id],
    queryFn: async () => {
      const response = await apiClient.get(`/vehicles/${id}`)
      return response as Vehicle
    },
  })
}

export function useVehicleStatus(id: string) {
  return useQuery({
    queryKey: ['vehicles', id, 'status'],
    queryFn: async () => {
      const response = await apiClient.get(`/vehicles/${id}/status`)
      return response as VehicleStatus
    },
    refetchInterval: 60000, // 60 seconds
  })
}

export function useAddVehicle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      brand: number
      region: number
      username: string
      password: string
      pin?: string
      nickname: string
    }) => {
      const response = await apiClient.post('/vehicles', data)
      return response as Vehicle
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string
      nickname?: string
      pin?: string
      is_default?: boolean
    }) => {
      const response = await apiClient.put(`/vehicles/${id}`, data)
      return response as Vehicle
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles', data.id] })
    },
  })
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/vehicles/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })
}

export function useSetDefaultVehicle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/vehicles/${id}/default`)
      return response as Vehicle
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })
}

export function useLockVehicle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vehicleId: string) => {
      await apiClient.post(`/commands/${vehicleId}/lock`)
    },
    onSuccess: (_, vehicleId) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles', vehicleId, 'status'] })
      queryClient.invalidateQueries({ queryKey: ['history'] })
    },
  })
}

export function useUnlockVehicle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vehicleId: string) => {
      await apiClient.post(`/commands/${vehicleId}/unlock`)
    },
    onSuccess: (_, vehicleId) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles', vehicleId, 'status'] })
      queryClient.invalidateQueries({ queryKey: ['history'] })
    },
  })
}

export function useStartClimate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      vehicleId,
      temp,
      duration,
      defrost,
    }: {
      vehicleId: string
      temp?: number
      duration?: number
      defrost?: boolean
    }) => {
      await apiClient.post(`/commands/${vehicleId}/start`, {
        temp,
        duration,
        defrost,
      })
    },
    onSuccess: (_, { vehicleId }) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles', vehicleId, 'status'] })
      queryClient.invalidateQueries({ queryKey: ['history'] })
    },
  })
}

export function useStopClimate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vehicleId: string) => {
      await apiClient.post(`/commands/${vehicleId}/stop`)
    },
    onSuccess: (_, vehicleId) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles', vehicleId, 'status'] })
      queryClient.invalidateQueries({ queryKey: ['history'] })
    },
  })
}

export function useStartCharge() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vehicleId: string) => {
      await apiClient.post(`/commands/${vehicleId}/charge-start`)
    },
    onSuccess: (_, vehicleId) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles', vehicleId, 'status'] })
      queryClient.invalidateQueries({ queryKey: ['history'] })
    },
  })
}

export function useStopCharge() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vehicleId: string) => {
      await apiClient.post(`/commands/${vehicleId}/charge-stop`)
    },
    onSuccess: (_, vehicleId) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles', vehicleId, 'status'] })
      queryClient.invalidateQueries({ queryKey: ['history'] })
    },
  })
}
