import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService, IAuthCredentials } from './AuthService';
import { MongoService } from './MongoService';
import { IHackathon, IUserProfile } from './models';

@Component({
  selector: 'app-dashboard',
  template: `
    <div class="dashboard-container">
      <h1>Xiimalab Dashboard</h1>

      <!-- User info section -->
      <div *ngIf="currentUser; else loginSection" class="user-section">
        <h2>Welcome, {{ currentUser.profile.name || currentUser.profile.email }}!</h2>
        <button (click)="logout()" class="btn btn-secondary">Logout</button>
      </div>

      <!-- Login section -->
      <ng-template #loginSection>
        <div class="login-section">
          <h2>Login to Your Account</h2>
          <form (ngSubmit)="onLogin()">
            <div>
              <label>Email:</label>
              <input [(ngModel)]="credentials.email" type="email" required />
            </div>
            <div>
              <label>Password:</label>
              <input [(ngModel)]="credentials.password" type="password" required />
            </div>
            <button type="submit" class="btn btn-primary">Login</button>
            <button type="button" (click)="onAnonymousLogin()" class="btn btn-secondary">
              Anonymous Login
            </button>
          </form>
        </div>
      </ng-template>

      <!-- Dashboard content -->
      <div *ngIf="currentUser" class="dashboard-content">
        <!-- User profile section -->
        <div class="profile-section">
          <h3>Your Profile</h3>
          <div *ngIf="userProfile$ | async as userProfile">
            <p>Name: {{ userProfile.name }}</p>
            <p>Email: {{ userProfile.email }}</p>
            <p>Member since: {{ userProfile.createdAt | date }}</p>
          </div>
        </div>

        <!-- Hackathons section -->
        <div class="hackathons-section">
          <h3>Recommended Hackathons</h3>
          <div *ngIf="hackathons$ | async as hackathons; else loading">
            <div *ngFor="let hackathon of hackathons" class="hackathon-card">
              <h4>{{ hackathon.title }}</h4>
              <p>{{ hackathon.description }}</p>
              <p>Prize Pool: \${{ hackathon.prizePool }}</p>
              <p>End Date: {{ hackathon.endDate | date }}</p>
              <div class="tags">
                <span *ngFor="let tag of hackathon.tags" class="tag">{{ tag }}</span>
              </div>
              <div class="scores" *ngIf="hackathon.matchScore !== undefined">
                <span>Match: {{ hackathon.matchScore }}%</span>
                <span>Urgency: {{ hackathon.urgencyScore }}%</span>
                <span>Value: {{ hackathon.valueScore }}%</span>
              </div>
            </div>
          </div>
          <ng-template #loading>
            <p>Loading hackathons...</p>
          </ng-template>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .user-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding: 20px;
      background-color: #f5f5f5;
      border-radius: 8px;
    }

    .login-section {
      max-width: 400px;
      margin: 0 auto;
      padding: 30px;
      border: 1px solid #ddd;
      border-radius: 8px;
    }

    .login-section form div {
      margin-bottom: 15px;
    }

    .login-section label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }

    .login-section input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }

    .btn-primary {
      background-color: #007bff;
      color: white;
    }

    .btn-secondary {
      background-color: #6c757d;
      color: white;
      margin-left: 10px;
    }

    .hackathon-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      background-color: #fafafa;
    }

    .tags {
      margin: 10px 0;
    }

    .tag {
      display: inline-block;
      background-color: #007bff;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      margin-right: 5px;
      font-size: 12px;
    }

    .scores span {
      margin-right: 15px;
      font-weight: bold;
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  currentUser: any = null;
  credentials: IAuthCredentials = { email: '', password: '' };

  userProfile$: any;
  hackathons$: any;

  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private mongoService: MongoService
  ) {}

  ngOnInit(): void {
    // Subscribe to user authentication state changes
    const userSubscription = this.authService.getCurrentUser().subscribe(
      user => {
        this.currentUser = user;
        if (user) {
          // Load user data when authenticated
          this.loadUserData();
        }
      }
    );

    this.subscriptions.push(userSubscription);
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions to prevent memory leaks
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async onLogin(): Promise<void> {
    try {
      await this.authService.login(this.credentials);
      this.credentials = { email: '', password: '' }; // Clear form
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed: ' + error.message);
    }
  }

  async onAnonymousLogin(): Promise<void> {
    try {
      await this.authService.loginAnonymous();
    } catch (error) {
      console.error('Anonymous login failed:', error);
      alert('Anonymous login failed: ' + error.message);
    }
  }

  async logout(): Promise<void> {
    try {
      await this.authService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
      alert('Logout failed: ' + error.message);
    }
  }

  private loadUserData(): void {
    // Load user profile
    this.userProfile$ = this.mongoService.findById<IUserProfile>('userProfiles', this.currentUser.id);

    // Load recommended hackathons
    this.hackathons$ = this.mongoService.findByQuery<IHackathon>('hackathons', {
      matchScore: { $gte: 50 }
    });
  }
}