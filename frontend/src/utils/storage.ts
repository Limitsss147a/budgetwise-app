/**
 * Safe AsyncStorage wrapper with in-memory fallback
 * Handles cases where native module is not available (e.g., Expo Go)
 */

let AsyncStorageModule: any = null;
let storageAvailable = false;

// In-memory fallback storage
const memoryStorage: Record<string, string> = {};

// Try to load AsyncStorage
try {
  AsyncStorageModule = require('@react-native-async-storage/async-storage').default;
  storageAvailable = true;
} catch {
  console.warn('[Storage] AsyncStorage native module not available, using in-memory fallback');
}

export const SafeStorage = {
  async getItem(key: string): Promise<string | null> {
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
    try {
      if (storageAvailable && AsyncStorageModule) {
        await AsyncStorageModule.multiRemove(keys);
      }
    } catch (e) {
      console.warn(`[Storage] multiRemove failed:`, e);
    }
  },
};

export default SafeStorage;
