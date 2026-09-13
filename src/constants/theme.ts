/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// Warm, premium palette for AI Money — see design system in CLAUDE.md.
export const colors = {
  // Warm cream/beige app background — used everywhere instead of white or dark mode
  background: '#F5EFE6',
  // Slightly lighter than the app background — used for cards that should float above it
  cardBackground: '#FCFAF5',
  // Terracotta/burnt-orange — balance cards, primary buttons, highlights
  primaryAccent: '#C1613B',
  // Soft coral/salmon — alerts and secondary highlights
  secondaryAccent: '#E8917A',
  // Dark charcoal/near-black — body and hero text, never pure black
  text: '#2B2620',
  // Muted version of `text` for secondary/de-emphasized text (labels, hints,
  // captions, placeholders) — a single standard instead of ad hoc opacity.
  textMuted: '#8A8478',
  // Muted sage green — tertiary chart color
  chartSage: '#8A9A7E',
  // Dusty blue — tertiary chart color
  chartDustyBlue: '#7C93A8',
} as const;

// Basic type scale for AI Money — see design system in CLAUDE.md.
export const typography = {
  // Large, bold hero stats — e.g. account balance
  heroNumber: {
    fontSize: 40,
    fontWeight: '700',
  },
  // Screen-level titles — "Transactions", "Bills", modal headers, etc.
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  // Small uppercase eyebrow label above a section or card group —
  // "PREFERENCES", "SAVINGS GOALS", "TOTAL SPENT".
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Normal readable body text
  body: {
    fontSize: 16,
    fontWeight: '400',
  },
  // Secondary/muted small text — dates, hints, sub-labels.
  caption: {
    fontSize: 13,
    fontWeight: '400',
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
