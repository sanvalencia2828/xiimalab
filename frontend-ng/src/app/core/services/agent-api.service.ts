import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiBaseService } from './api-base.service';

@Injectable({ providedIn: 'root' })
export class AgentApiService {
  private api = inject(ApiBaseService);

  getStatus(): Observable<unknown> {
    return this.api.safeFetch(`${this.api.apiUrl}/agents/status`).pipe(catchError(() => of(null)));
  }

  run(agentName: string): Observable<unknown> {
    return this.api.safePost(`${this.api.apiUrl}/agents/run`, { agent: agentName }).pipe(catchError(() => of(null)));
  }

  generateAssets(): Observable<unknown> {
    return this.api.safePost(`${this.api.apiUrl}/agents/generate-assets`, {}).pipe(catchError(() => of(null)));
  }
}
