import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiBaseService } from './api-base.service';

@Injectable({ providedIn: 'root' })
export class MatchApiService {
  private api = inject(ApiBaseService);

  evaluateMatch(profileData: unknown): Observable<unknown> {
    return this.api.safePost(`${this.api.apiUrl}/match/evaluate`, profileData).pipe(
      catchError(() => of(null)),
    );
  }

  getMarketTrends(): Observable<unknown> {
    return this.api.safeFetch(`${this.api.apiUrl}/market/trends`).pipe(
      catchError(() => of(null)),
    );
  }
}
