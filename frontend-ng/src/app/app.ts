import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import SidebarNavComponent from './shared/components/sidebar-nav/sidebar-nav.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SidebarNavComponent],
  template: `
    <div class="flex min-h-screen bg-background">
      <app-sidebar-nav />
      <main class="flex-1 ml-0 md:ml-64 min-h-screen">
        <router-outlet />
      </main>
    </div>
  `
})
export class App {}
