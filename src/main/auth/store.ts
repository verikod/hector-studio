import { safeStorage } from 'electron'
import Store from 'electron-store'

interface AuthData {
  encryptedToken: string
}

const store = new Store<Record<string, AuthData>>({
  name: 'auth-store',
  encryptionKey: 'hector-studio-secure-storage' // Optional additional layer
})

export class AuthStore {
  async setToken(serverUrl: string, token: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Safe storage is not available on this system')
    }
    const encrypted = safeStorage.encryptString(token)
    store.set(serverUrl, { encryptedToken: encrypted.toString('base64') })
  }

  async getToken(serverUrl: string): Promise<string | null> {
    if (!safeStorage.isEncryptionAvailable()) {
      return null
    }

    const data = store.get(serverUrl) as AuthData | undefined
    if (!data || !data.encryptedToken) {
      return null
    }

    try {
      const buffer = Buffer.from(data.encryptedToken, 'base64')
      return safeStorage.decryptString(buffer)
    } catch (error) {
      console.error('Failed to decrypt token for', serverUrl, error)
      return null
    }
  }

  async deleteToken(serverUrl: string): Promise<void> {
    store.delete(serverUrl)
  }

  async clear(): Promise<void> {
    store.clear()
  }
}

export const authStore = new AuthStore()
