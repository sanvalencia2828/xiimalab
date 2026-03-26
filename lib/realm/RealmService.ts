import * as Realm from "realm-web";
import { BehaviorSubject } from "rxjs";

// Define the Realm app ID from environment variables
const APP_ID = process.env.REALM_APP_ID;

// Interface for Realm user
export interface IRealmUser {
  id: string;
  profile: Realm.UserProfile;
  isLoggedIn: boolean;
}

// RealmService class as a singleton
export class RealmService {
  private static instance: RealmService;
  private app: Realm.App;
  private currentUserSubject: BehaviorSubject<IRealmUser | null>;

  private constructor() {
    if (!APP_ID) {
      throw new Error("REALM_APP_ID environment variable is not defined");
    }

    // Initialize the Realm app
    this.app = new Realm.App(APP_ID);

    // Initialize the current user subject
    const currentUser = this.app.currentUser;
    this.currentUserSubject = new BehaviorSubject<IRealmUser | null>(
      currentUser ? {
        id: currentUser.id,
        profile: currentUser.profile,
        isLoggedIn: currentUser.isLoggedIn
      } : null
    );
  }

  // Singleton instance getter
  public static getInstance(): RealmService {
    if (!RealmService.instance) {
      RealmService.instance = new RealmService();
    }
    return RealmService.instance;
  }

  // Get the Realm app instance
  public getApp(): Realm.App {
    return this.app;
  }

  // Get the current user observable
  public getCurrentUserObservable(): BehaviorSubject<IRealmUser | null> {
    return this.currentUserSubject;
  }

  // Update the current user subject
  public updateCurrentUser(user: Realm.User | null): void {
    this.currentUserSubject.next(
      user ? {
        id: user.id,
        profile: user.profile,
        isLoggedIn: user.isLoggedIn
      } : null
    );
  }
}