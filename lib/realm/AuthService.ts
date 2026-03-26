import * as Realm from "realm-web";
import { BehaviorSubject, Observable } from "rxjs";
import { RealmService, IRealmUser } from "./RealmService";

export interface IAuthCredentials {
  email: string;
  password: string;
}

export class AuthService {
  private static instance: AuthService;
  private realmService: RealmService;
  private currentUserSubject: BehaviorSubject<IRealmUser | null>;

  private constructor() {
    this.realmService = RealmService.getInstance();
    this.currentUserSubject = this.realmService.getCurrentUserObservable();
  }

  // Singleton instance getter
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Get current user as observable
  public getCurrentUser(): Observable<IRealmUser | null> {
    return this.currentUserSubject.asObservable();
  }

  // Login with email and password
  public async login(credentials: IAuthCredentials): Promise<IRealmUser> {
    try {
      const app = this.realmService.getApp();
      const user = await app.logIn(
        Realm.Credentials.emailPassword(credentials.email, credentials.password)
      );

      // Update the current user in the realm service
      this.realmService.updateCurrentUser(user);

      const realmUser: IRealmUser = {
        id: user.id,
        profile: user.profile,
        isLoggedIn: user.isLoggedIn
      };

      return realmUser;
    } catch (error) {
      console.error("Login failed:", error);
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  // Login with anonymous credentials
  public async loginAnonymous(): Promise<IRealmUser> {
    try {
      const app = this.realmService.getApp();
      const user = await app.logIn(Realm.Credentials.anonymous());

      // Update the current user in the realm service
      this.realmService.updateCurrentUser(user);

      const realmUser: IRealmUser = {
        id: user.id,
        profile: user.profile,
        isLoggedIn: user.isLoggedIn
      };

      return realmUser;
    } catch (error) {
      console.error("Anonymous login failed:", error);
      throw new Error(`Anonymous login failed: ${error.message}`);
    }
  }

  // Logout current user
  public async logout(): Promise<void> {
    try {
      const app = this.realmService.getApp();
      const user = app.currentUser;

      if (user) {
        await user.logOut();
        // Update the current user in the realm service
        this.realmService.updateCurrentUser(null);
      }
    } catch (error) {
      console.error("Logout failed:", error);
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  // Get current user synchronously
  public getCurrentUserSync(): IRealmUser | null {
    return this.currentUserSubject.getValue();
  }

  // Check if user is logged in
  public isLoggedIn(): boolean {
    const currentUser = this.currentUserSubject.getValue();
    return !!currentUser && currentUser.isLoggedIn;
  }
}