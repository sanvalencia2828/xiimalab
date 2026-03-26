// lib/realm/initRealm.ts
// Initialization script for MongoDB Realm services in Xiimalab

import { RealmService } from './RealmService';
import { AuthService } from './AuthService';
import { MongoService } from './MongoService';

/**
 * Initialize MongoDB Realm services for Xiimalab
 * This should be called once at application startup
 */
export function initRealmServices(): {
  realmService: RealmService;
  authService: AuthService;
  mongoService: MongoService;
} {
  try {
    // Initialize the Realm service (singleton)
    const realmService = RealmService.getInstance();

    // Initialize the Auth service (singleton)
    const authService = AuthService.getInstance();

    // Initialize the Mongo service
    const mongoService = new MongoService();

    console.log('MongoDB Realm services initialized successfully');

    return {
      realmService,
      authService,
      mongoService
    };
  } catch (error) {
    console.error('Failed to initialize MongoDB Realm services:', error);
    throw new Error(`Realm initialization failed: ${error.message}`);
  }
}

/**
 * Example usage in a Next.js app:
 *
 * // In your app/layout.tsx or similar initialization file
 * import { initRealmServices } from '@/lib/realm/initRealm';
 *
 * // Initialize services once at startup
 * const { authService, mongoService } = initRealmServices();
 *
 * // Use authService in components for authentication
 * // Use mongoService for data operations
 */

export default initRealmServices;