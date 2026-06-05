import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import { useStore } from '../lib/store'

interface User {
  id: string
  email: string
}

interface SignInResponse {
  sessionId: string
  user: User
}

export function useSignIn() {
  const { setSession } = useStore()

  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await apiClient.post('/auth/signin', data)
      return response as SignInResponse
    },
    onSuccess: (data) => {
      setSession(data.sessionId, data.user)
    },
  })
}

export function useSignUp() {
  const { setSession } = useStore()

  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await apiClient.post('/auth/signup', data)
      return response as SignInResponse
    },
    onSuccess: (data) => {
      setSession(data.sessionId, data.user)
    },
  })
}

export function useSignOut() {
  const { clearSession } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/signout')
    },
    onSuccess: () => {
      clearSession()
      queryClient.clear()
    },
  })
}

export function useMe() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await apiClient.get('/auth/me')
      return response as { user: User }
    },
    retry: false,
  })
}
