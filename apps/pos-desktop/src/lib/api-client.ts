const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export async function apiClient(endpoint: string, options: RequestInit = {}) {
  const token = await window.ipcRenderer.secureStorage.get('accessToken');
  
  const isFormData = options.body instanceof FormData;
  
  const headers: any = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Terjadi kesalahan sistem');
  }

  return data;
}
