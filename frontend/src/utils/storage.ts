import * as SecureStore from 'expo-secure-store';

let AsyncStorageModule: any = null;
let storageAvailable = false;

// In-memory fallback storage
const memoryStorage: Record<string, string> = {};
const SECURE_KEYS = ['access_token', 'refresh_token'];

// Try to load AsyncStorage
try {
  AsyncStorageModule = require('@react-native-async-storage/async-storage').default;
  storageAvailable = true;
} catch {
  console.warn('[Storage] AsyncStorage native module not available, using in-memory fallback');
}

export const SafeStorage = {
  async getItem(key: string): Promise<string | null> {
    if (SECURE_KEYS.includes(key)) {
      try { 
        return await SecureStore.getItemAsync(key); 
      } catch { 
        return memoryStorage[key] ?? null; 
      }
    }
    
    try {
      if (storageAvailable && AsyncStorageModule) {
        return await AsyncStorageModule.getItem(key);
      }
    } catch (e) {
      console.warn(`[Storage] getItem('${key}') failed, using memory fallback:`, e);
    }
    return memoryStorage[key] ?? null;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (SECURE_KEYS.includes(key)) {
      memoryStorage[key] = value; // in-memory fallback tetap ada
      try { 
        await SecureStore.setItemAsync(key, value); 
      } catch {}
      return;
    }
    
    memoryStorage[key] = value;
    try {
      if (storageAvailable && AsyncStorageModule) {
        await AsyncStorageModule.setItem(key, value);
      }
    } catch (e) {
      console.warn(`[Storage] setItem('${key}') failed, stored in memory only:`, e);
    }
  },

  async removeItem(key: string): Promise<void> {
    delete memoryStorage[key];
    if (SECURE_KEYS.includes(key)) {
      try { 
        await SecureStore.deleteItemAsync(key); 
      } catch {}
      return;
    }
    
    try {
      if (storageAvailable && AsyncStorageModule) {
        await AsyncStorageModule.removeItem(key);
      }
    } catch (e) {
      console.warn(`[Storage] removeItem('${key}') failed:`, e);
    }
  },

  async multiRemove(keys: string[]): Promise<void> {
    keys.forEach(k => delete memoryStorage[k]);
    for (const key of keys) {
      if (SECURE_KEYS.includes(key)) {
        try { 
          await SecureStore.deleteItemAsync(key); 
        } catch {}
      } else {
        try {
          if (storageAvailable && AsyncStorageModule) {
            await AsyncStorageModule.removeItem(key);
          }
        } catch (e) {}
      }
    }
  },
};

export default SafeStorage;
