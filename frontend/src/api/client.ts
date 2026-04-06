import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
})

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const detail = err.response?.data?.detail ?? err.message
    return Promise.reject(new Error(String(detail)))
  },
)

export async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const res = await apiClient.get<T>(path, { params })
  return res.data
}

export async function post<T>(path: string, data?: unknown): Promise<T> {
  const res = await apiClient.post<T>(path, data)
  return res.data
}
