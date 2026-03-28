import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  LayoutDashboard,
  Cpu,
  Brain,
  Zap,
  Database,
  Briefcase,
  ChartBar,
  Target,
  ShoppingBag,
  FolderKanban,
  Settings,
  Menu,
  X,
  ChevronRight,
  Wallet,
  CircleCheck,
} from 'lucide-angular';

import { WalletService } from '../../../core/services/wallet.service';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { fadeInLeft, fade } from '../../animations';

interface NavItem {
  href: string;
  icon: string;
  label: string;
  badgeKey?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', icon: 'LayoutDashboard', label: 'Inicio' },
  { href: '/dashboard', icon: 'Cpu', label: 'Dashboard Estudiante' },
  { href: '/skills', icon: 'Brain', label: 'Skills' },
  { href: '/hackathons', icon: 'Zap', label: 'Hackatones', badgeKey: 'hackathons' },
  { href: '/aggregated', icon: 'Database', label: 'Aggregated' },
  { href: '/portfolio', icon: 'Briefcase', label: 'Portfolio' },
  { href: '/match', icon: 'ChartBar', label: 'Market Match', badgeKey: 'insights' },
  { href: '/profile', icon: 'Target', label: 'Mi Perfil' },
  { href: '/ecommerce', icon: 'ShoppingBag', label: 'Staking' },
  { href: '/projects', icon: 'FolderKanban', label: 'Proyectos' },
  { href: '/settings', icon: 'Settings', label: 'Configuracion' },
];

const SIDEBAR_ICONS = {
  LayoutDashboard,
  Cpu,
  Brain,
  Zap,
  Database,
  Briefcase,
  ChartBar,
  Target,
  ShoppingBag,
  FolderKanban,
  Settings,
  Menu,
  X,
  ChevronRight,
  Wallet,
  CircleCheck,
};

@Component({
  selector: 'app-sidebar-nav',
  imports: [
    RouterLink,
    LucideAngularModule,
  ],
  providers: [
    { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(SIDEBAR_ICONS) },
  ],
  templateUrl: './sidebar-nav.component.html',
  animations: [fadeInLeft, fade],
})
export default class SidebarNavComponent implements OnInit {
  private router = inject(Router);
  private api = inject(ApiBaseService);
  private platformId = inject(PLATFORM_ID);
  wallet = inject(WalletService);

  readonly isOpen = signal(false);
  readonly badges = signal<Record<string, number>>({});
  readonly navItems = NAV_ITEMS;

  get currentUrl(): string {
    return this.router.url.split('?')[0];
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.fetchBadges();
    }
  }

  toggleMenu(): void {
    this.isOpen.update(v => !v);
  }

  closeMenu(): void {
    this.isOpen.set(false);
  }

  isActive(href: string): boolean {
    return this.currentUrl === href;
  }

  getBadgeCount(badgeKey: string | undefined): number {
    if (!badgeKey) return 0;
    return this.badges()[badgeKey] ?? 0;
  }

  private fetchBadges(): void {
    const url = `${this.api.apiUrl}/insights/priorities?days_window=30`;
    this.api.safeFetch<{ insights?: { urgent_hackathons?: number; total_hackathons?: number } }>(url)
      .subscribe(data => {
        if (data?.insights) {
          this.badges.set({
            hackathons: data.insights.total_hackathons ?? 0,
            insights: data.insights.urgent_hackathons ?? 0,
          });
        }
      });
  }
}
