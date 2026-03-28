import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiBaseService } from './api-base.service';

export interface UserSkill {
  name: string;
  level: number;
  category: string;
}

export interface SkillRelevance {
  skill: string;
  score: number;
  trend: 'up' | 'stable';
}

@Injectable({ providedIn: 'root' })
export class SkillApiService {
  private api = inject(ApiBaseService);

  loadUserSkills(wallet: string): Observable<{ skills: UserSkill[] } | null> {
    return this.api.safeFetch<{ skills: UserSkill[] }>(`${this.api.apiUrl}/skills/${wallet}`).pipe(
      catchError(() => of({ skills: [] })),
    );
  }

  saveUserSkills(wallet: string, skills: UserSkill[]): Observable<unknown> {
    return this.api.safePost(`${this.api.apiUrl}/skills/${wallet}`, { skills }).pipe(
      catchError(() => of(false)),
    );
  }

  getSkillRelevance(): Observable<{ relevance_report: SkillRelevance[] } | null> {
    return this.api.safeFetch<{ relevance_report: SkillRelevance[] }>(`${this.api.apiUrl}/insights/skill-relevance`).pipe(
      catchError(() => of(null)),
    );
  }

  getMLRecommendations(wallet: string): Observable<unknown> {
    return this.api.safeFetch(`${this.api.apiUrl}/recommendations/${wallet}`).pipe(
      catchError(() => of(null)),
    );
  }
}
