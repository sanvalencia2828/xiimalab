# MongoDB Realm Integration for Xiimalab

This directory contains the MongoDB Realm integration for the Xiimalab frontend, providing a decoupled and reactive architecture for data management and user authentication.

## Architecture Overview

### Core Services

1. **RealmService** - Singleton service that initializes the MongoDB Realm App
2. **AuthService** - Handles user authentication (login/logout) with reactive state management
3. **MongoService** - Generic service for interacting with MongoDB collections using RxJS
4. **AuthGuard** - Route protection guard for Angular applications

### Key Features

- **Reactive Architecture**: Uses RxJS BehaviorSubject for reactive state management
- **Type Safety**: Full TypeScript support with defined interfaces
- **Environment Configuration**: Uses environment variables for Realm App ID
- **Singleton Pattern**: Ensures single instances of core services
- **Error Handling**: Comprehensive error handling with meaningful messages
- **Real-time Ready**: Designed to support real-time updates and synchronization

## Setup Instructions

1. Create a MongoDB Atlas cluster and Realm app
2. Add your Realm App ID to `.env`:
   ```
   REALM_APP_ID=your_realm_app_id_here
   ```
3. Install dependencies:
   ```bash
   npm install realm @realm/react
   ```

## Usage Examples

### 1. Basic Authentication

```typescript
import { AuthService } from '@/lib/realm';

const authService = AuthService.getInstance();

// Login
await authService.login({ email: 'user@example.com', password: 'password' });

// Check auth state
authService.getCurrentUser().subscribe(user => {
  if (user) {
    console.log('User logged in:', user);
  } else {
    console.log('User not logged in');
  }
});
```

### 2. Data Operations

```typescript
import { MongoService } from '@/lib/realm';

const mongoService = new MongoService();

// Find all hackathons
mongoService.findAll('hackathons').subscribe(hackathons => {
  console.log('Hackathons:', hackathons);
});

// Insert a new document
mongoService.insertOne('userProfiles', {
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: new Date(),
  updatedAt: new Date(),
  preferences: {
    theme: 'dark',
    notifications: true
  }
}).subscribe(profile => {
  console.log('Created profile:', profile);
});
```

### 3. Route Protection

```typescript
// In your Angular route configuration
import { AuthGuard } from '@/lib/realm';

const routes: Routes = [
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard]
  }
];
```

## Services Details

### RealmService
- Initializes the MongoDB Realm application
- Manages the current user state with BehaviorSubject
- Provides access to the Realm app instance

### AuthService
- Handles user authentication (email/password, anonymous)
- Exposes current user state as Observable
- Provides synchronous and asynchronous methods for auth state

### MongoService
- Generic service for MongoDB collection operations
- Wraps Realm MongoDB collection methods with RxJS Observables
- Provides CRUD operations with proper error handling
- Supports querying, insertion, updating, and deletion

### Models
- Type definitions for MongoDB documents
- Includes interfaces for common entities like UserProfile, Hackathon, etc.

## Environment Variables

Add the following to your `.env` file:

```
REALM_APP_ID=your_realm_app_id_here
```

## Dependencies

- `realm`: MongoDB Realm SDK
- `@realm/react`: React integration for Realm (optional)
- `rxjs`: Reactive programming library