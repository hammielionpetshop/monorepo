import { serverConfig } from './server-config';

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

  const response = await fetch(`${serverConfig.getUrl()}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Terjadi kesalahan sistem');
  }

  return data;
}
