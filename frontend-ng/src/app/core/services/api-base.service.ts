import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiBaseService {
  private http = inject(HttpClient);

  get apiUrl(): string {
    return environment.apiUrl;
  }

  safeFetch<T>(url: string): Observable<T | null> {
    return this.http.get<T>(url).pipe(
      timeout(5000),
      catchError(() => of(null)),
    );
  }

  safePost<T>(url: string, body: unknown): Observable<T | null> {
    return this.http.post<T>(url, body).pipe(
      timeout(5000),
      catchError(() => of(null)),
    );
  }
}
