import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiBaseService } from './api-base.service';

@Injectable({ providedIn: 'root' })
export class PortfolioApiService {
  private api = inject(ApiBaseService);
}
