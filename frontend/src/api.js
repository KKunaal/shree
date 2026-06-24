import axios from 'axios'

/**
 * Returns an axios instance pre-configured with Basic Auth.
 * Uses VITE_API_URL env var in production, falls back to /api for dev (proxied by Vite)
 */
export function createApiClient(token) {
  const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    },
  })

  // Intercept 401 responses to prevent browser's default auth popup
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      // Don't let the browser show its default auth popup
      if (error.response?.status === 401) {
        // Just return the error without triggering browser auth
        return Promise.reject(error)
      }
      return Promise.reject(error)
    }
  )

  return client
}
