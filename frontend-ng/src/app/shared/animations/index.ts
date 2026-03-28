import {
  trigger,
  transition,
  style,
  animate,
  query,
  stagger,
  state,
  animateChild,
} from '@angular/animations';

// Replaces: initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
export const fadeInUp = trigger('fadeInUp', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(20px)' }),
    animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
  ]),
  transition(':leave', [
    animate('300ms ease-in', style({ opacity: 0, transform: 'translateY(20px)' })),
  ]),
]);

// Replaces: initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
export const fadeInDown = trigger('fadeInDown', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(-20px)' }),
    animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
  ]),
  transition(':leave', [
    animate('300ms ease-in', style({ opacity: 0, transform: 'translateY(-20px)' })),
  ]),
]);

// Replaces: initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
export const fadeInRight = trigger('fadeInRight', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateX(20px)' }),
    animate('400ms ease-out', style({ opacity: 1, transform: 'translateX(0)' })),
  ]),
  transition(':leave', [
    animate('300ms ease-in', style({ opacity: 0, transform: 'translateX(20px)' })),
  ]),
]);

// Replaces: initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
export const fadeInLeft = trigger('fadeInLeft', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateX(-10px)' }),
    animate('400ms ease-out', style({ opacity: 1, transform: 'translateX(0)' })),
  ]),
  transition(':leave', [
    animate('300ms ease-in', style({ opacity: 0, transform: 'translateX(-10px)' })),
  ]),
]);

// Replaces: initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
export const scaleIn = trigger('scaleIn', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.9)' }),
    animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1)' })),
  ]),
  transition(':leave', [
    animate('200ms ease-in', style({ opacity: 0, transform: 'scale(0.9)' })),
  ]),
]);

// Replaces framer-motion stagger pattern
// Usage: <div @staggerList>  <div *ngFor @staggerItem>
export const staggerList = trigger('staggerList', [
  transition(':enter', [
    query('@fadeInUp, @fadeInRight, @scaleIn, @staggerItem', [
      stagger(50, animateChild()),
    ], { optional: true }),
  ]),
]);

export const staggerItem = trigger('staggerItem', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(10px)' }),
    animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
  ]),
]);

// Replaces AnimatePresence enter/leave with tab switching
export const slideToggle = trigger('slideToggle', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(10px)' }),
    animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
  ]),
  transition(':leave', [
    animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' })),
  ]),
]);

// Width animation for progress bars
// Replaces: initial={{ width: 0 }} animate={{ width: `${value}%` }}
export const expandWidth = trigger('expandWidth', [
  transition(':enter', [
    style({ width: '0%' }),
    animate('600ms 100ms ease-out'),
  ]),
]);

// Simple fade for overlays/modals
export const fade = trigger('fade', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate('200ms ease-out', style({ opacity: 1 })),
  ]),
  transition(':leave', [
    animate('150ms ease-in', style({ opacity: 0 })),
  ]),
]);

// Pulse glow animation (for urgent items)
export const pulseGlow = trigger('pulseGlow', [
  state('active', style({ boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)' })),
  state('inactive', style({ boxShadow: 'none' })),
  transition('inactive <=> active', animate('1s ease-in-out')),
]);
