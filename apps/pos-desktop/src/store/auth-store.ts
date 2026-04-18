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
  isInitialized: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isInitialized: false,
  login: async (user, accessToken, refreshToken) => {
    await window.ipcRenderer.secureStorage.set('accessToken', accessToken);
    await window.ipcRenderer.secureStorage.set('refreshToken', refreshToken);
    await window.ipcRenderer.secureStorage.set('user', JSON.stringify(user));
    set({ user, isAuthenticated: true, isInitialized: true });
  },
  logout: async () => {
    await window.ipcRenderer.secureStorage.remove('accessToken');
    await window.ipcRenderer.secureStorage.remove('refreshToken');
    await window.ipcRenderer.secureStorage.remove('user');
    set({ user: null, isAuthenticated: false, isInitialized: true });
  },
  checkAuth: async () => {
    try {
      const token = await window.ipcRenderer.secureStorage.get('accessToken');
      const userStr = await window.ipcRenderer.secureStorage.get('user');
      
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          set({ user, isAuthenticated: true, isInitialized: true });
        } catch (e) {
          // If JSON parsing fails, treat as not logged in
          set({ user: null, isAuthenticated: false, isInitialized: true });
        }
      } else {
        set({ user: null, isAuthenticated: false, isInitialized: true });
      }
    } catch (e) {
      set({ user: null, isAuthenticated: false, isInitialized: true });
    }
  }
}));
