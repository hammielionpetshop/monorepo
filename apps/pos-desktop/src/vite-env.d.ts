/// <reference types="vite/client" />

interface Window {
  ipcRenderer: {
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => void
    off: (channel: string, listener: (event: any, ...args: any[]) => void) => void
    send: (channel: string, ...args: any[]) => void
    invoke: (channel: string, ...args: any[]) => Promise<any>
    secureStorage: {
      set: (key: string, value: string) => Promise<boolean>
      get: (key: string) => Promise<string | null>
      remove: (key: string) => Promise<boolean>
    }
    printer: {
      printReceipt: (payload: any) => Promise<{ success: boolean; mocked?: boolean; error?: string }>
      printSettlement: (payload: any) => Promise<{ success: boolean; mocked?: boolean; error?: string }>
    }
  }
}
