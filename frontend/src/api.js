import axios from 'axios'

/**
 * Returns an axios instance pre-configured with Basic Auth.
 * baseURL is /api — Vite's proxy forwards to http://127.0.0.1:8000
 */
export function createApiClient(token) {
  return axios.create({
    baseURL: '/api',
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    },
  })
}
