import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home.component'), title: 'Xiimalab | Intelligence Hub' },
  { path: 'home', redirectTo: '', pathMatch: 'full' },
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component'), title: 'Dashboard | Xiimalab' },
  { path: 'skills', loadComponent: () => import('./pages/skills/skills.component'), title: 'Skills | Xiimalab' },
  { path: 'hackathons', loadComponent: () => import('./pages/hackathons/hackathons.component'), title: 'Hackathons | Xiimalab' },
  { path: 'aggregated', loadComponent: () => import('./pages/aggregated/aggregated.component'), title: 'Aggregated | Xiimalab' },
  { path: 'portfolio', loadComponent: () => import('./pages/portfolio/portfolio.component'), title: 'Portfolio | Xiimalab' },
  { path: 'profile', loadComponent: () => import('./pages/profile/profile.component'), title: 'Profile | Xiimalab' },
  { path: 'perfil', loadComponent: () => import('./pages/perfil/perfil.component'), title: 'Perfil | Xiimalab' },
  { path: 'match', loadComponent: () => import('./pages/match/match.component'), title: 'Match | Xiimalab' },
  { path: 'agents', loadComponent: () => import('./pages/agents/agents.component'), title: 'Agents | Xiimalab' },
  { path: 'projects', loadComponent: () => import('./pages/projects/projects.component'), title: 'Projects | Xiimalab' },
  { path: 'ecommerce', loadComponent: () => import('./pages/ecommerce/ecommerce.component'), title: 'E-commerce | Xiimalab' },
  { path: 'staking', loadComponent: () => import('./pages/staking/staking.component'), title: 'Staking | Xiimalab' },
  { path: 'settings', loadComponent: () => import('./pages/settings/settings.component'), title: 'Settings | Xiimalab' },
  { path: '**', loadComponent: () => import('./pages/not-found/not-found.component'), title: '404 | Xiimalab' },
];
