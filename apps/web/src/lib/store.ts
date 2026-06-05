import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
}

interface AppStore {
  sessionId: string | null
  user: User | null
  setSession(sessionId: string, user: User): void
  clearSession(): void
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      sessionId: null,
      user: null,
      setSession: (sessionId, user) => {
        set({ sessionId, user })
      },
      clearSession: () => {
        set({ sessionId: null, user: null })
      },
    }),
    {
      name: 'app-store',
    }
  )
)
