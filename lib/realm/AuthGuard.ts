import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './AuthService';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> {
    // Check if user is logged in
    const isLoggedIn = this.authService.isLoggedIn();

    if (isLoggedIn) {
      return of(true);
    } else {
      // Redirect to login page if not authenticated
      this.router.navigate(['/login']);
      return of(false);
    }
  }
}