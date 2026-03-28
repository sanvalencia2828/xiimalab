import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STORAGE_KEY = 'xiimalab_stellar_wallet';
const COOKIE_KEY = 'xiimalab_stellar_address';

interface WalletState {
  publicKey: string | null;
  displayName: string | null;
  connectedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class WalletService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  readonly publicKey = signal<string | null>(null);
  readonly displayName = signal<string | null>(null);
  readonly connectedAt = signal<string | null>(null);
  readonly isLoaded = signal(false);
  readonly isConnected = computed(() => !!this.publicKey());
  readonly studentAddress = computed(() => this.publicKey());

  constructor() {
    if (this.isBrowser) {
      this.loadFromStorage();
      this.isLoaded.set(true);
      window.addEventListener('storage', (e: StorageEvent) => {
        if (e.key === STORAGE_KEY) this.loadFromStorage();
      });
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const state: WalletState = JSON.parse(raw);
        this.publicKey.set(state.publicKey);
        this.displayName.set(state.displayName);
        this.connectedAt.set(state.connectedAt);
        return;
      }
      const match = document.cookie.match(new RegExp('(^| )' + COOKIE_KEY + '=([^;]+)'));
      if (match) {
        this.publicKey.set(match[2]);
      }
    } catch { /* ignore */ }
  }

  connect(publicKey: string, displayName?: string): void {
    const state: WalletState = {
      publicKey,
      displayName: displayName ?? `${publicKey.slice(0, 6)}...${publicKey.slice(-4)}`,
      connectedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    document.cookie = `${COOKIE_KEY}=${publicKey}; path=/; max-age=31536000; SameSite=Lax`;
    this.publicKey.set(state.publicKey);
    this.displayName.set(state.displayName);
    this.connectedAt.set(state.connectedAt);
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  }

  disconnect(): void {
    localStorage.removeItem(STORAGE_KEY);
    document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
    this.publicKey.set(null);
    this.displayName.set(null);
    this.connectedAt.set(null);
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  }
}
