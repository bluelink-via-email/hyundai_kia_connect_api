import { useStore } from './store'

const BASE_URL = '/api'

interface ApiOptions {
  body?: Record<string, any>
  headers?: Record<string, string>
}

async function request(method: string, path: string, options: ApiOptions = {}) {
  const sessionId = useStore.getState().sessionId

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (sessionId) {
    headers['Authorization'] = `Bearer ${sessionId}`
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'API Error' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response.json()
}

export const apiClient = {
  get: (path: string) => request('GET', path),
  post: (path: string, body?: Record<string, any>) =>
    request('POST', path, { body }),
  put: (path: string, body?: Record<string, any>) =>
    request('PUT', path, { body }),
  delete: (path: string) => request('DELETE', path),
}
