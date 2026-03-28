import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiBaseService } from './api-base.service';
import { Hackathon, AggregatedHackathon, normalizeHackathon } from '../models/types';

@Injectable({ providedIn: 'root' })
export class HackathonApiService {
  private api = inject(ApiBaseService);

  fetchHackathons(limit = 50): Observable<Hackathon[]> {
    return this.api.safeFetch<Hackathon[]>(`${this.api.apiUrl}/hackathons?limit=${limit}`).pipe(
      map(data => (data ?? []).map(h => normalizeHackathon(h as unknown as Record<string, unknown>))),
      catchError(() => of([])),
    );
  }

  fetchAggregated(wallet?: string): Observable<AggregatedHackathon[]> {
    const params = wallet ? `?wallet=${wallet}` : '';
    return this.api.safeFetch<AggregatedHackathon[]>(`${this.api.apiUrl}/hackathons/aggregated${params}`).pipe(
      map(data => data ?? []),
      catchError(() => of([])),
    );
  }

  getPriorities(daysWindow = 30): Observable<unknown> {
    return this.api.safeFetch(`${this.api.apiUrl}/insights/priorities?days_window=${daysWindow}`).pipe(
      catchError(() => of(null)),
    );
  }

  getTagAnalysis(): Observable<unknown> {
    return this.api.safeFetch(`${this.api.apiUrl}/insights/tag-analysis`).pipe(
      catchError(() => of(null)),
    );
  }
}
