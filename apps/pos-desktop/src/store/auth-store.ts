import { create } from 'zustand';

interface User {
  id: number;
  name: string;
  role: string;
  branch: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: async (user, accessToken, refreshToken) => {
    await window.ipcRenderer.secureStorage.set('accessToken', accessToken);
    await window.ipcRenderer.secureStorage.set('refreshToken', refreshToken);
    set({ user, isAuthenticated: true });
  },
  logout: async () => {
    await window.ipcRenderer.secureStorage.remove('accessToken');
    await window.ipcRenderer.secureStorage.remove('refreshToken');
    set({ user: null, isAuthenticated: false });
  },
  checkAuth: async () => {
    const token = await window.ipcRenderer.secureStorage.get('accessToken');
    if (token) {
      // In Phase 1, we just check if token exists. 
      // In real app, verify with server or decode JWT.
      // set({ isAuthenticated: true }); 
    }
  }
}));
