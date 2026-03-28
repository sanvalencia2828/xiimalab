import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <div class="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 class="text-6xl font-bold gradient-text">404</h1>
      <p class="text-muted-text mt-4 text-lg">Page Not Found</p>
      <a routerLink="/" class="mt-6 text-accent hover:underline">Volver al inicio</a>
    </div>
  `
})
export default class NotFoundComponent {}
