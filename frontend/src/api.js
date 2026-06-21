import axios from 'axios'

/**
 * Returns an axios instance pre-configured with Basic Auth.
 * Uses VITE_API_URL env var in production, falls back to /api for dev (proxied by Vite)
 */
export function createApiClient(token) {
  return axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    },
  })
}
