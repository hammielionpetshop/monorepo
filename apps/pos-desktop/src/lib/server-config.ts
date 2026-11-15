const STORAGE_KEY = 'hammielion_api_url'
const DEFAULT_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export const serverConfig = {
  getUrl(): string {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_URL
  },
  setUrl(url: string) {
    localStorage.setItem(STORAGE_KEY, url.replace(/\/$/, ''))
  },
  reset() {
    localStorage.removeItem(STORAGE_KEY)
  },
  getDefault(): string {
    return DEFAULT_URL
  },
}
