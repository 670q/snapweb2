import { atom } from 'nanostores';
import { logStore } from './logs';

export type Theme = 'dark';

export const kTheme = 'bolt_theme';

export function themeIsDark() {
  return themeStore.get() === 'dark';
}

export const DEFAULT_THEME = 'dark';

export const themeStore = atom<Theme>(initStore());

function initStore(): Theme {
  // Always return dark theme as it's the only theme available
  return 'dark' as Theme;
}

export function toggleTheme() {
  // Theme is locked to dark mode - no toggle functionality
  const theme = 'dark';

  // Ensure dark theme is set
  themeStore.set(theme);
  localStorage.setItem(kTheme, theme);
  document.querySelector('html')?.setAttribute('data-theme', theme);

  // Update user profile if it exists
  try {
    const userProfile = localStorage.getItem('bolt_user_profile');

    if (userProfile) {
      const profile = JSON.parse(userProfile);
      profile.theme = theme;
      localStorage.setItem('bolt_user_profile', JSON.stringify(profile));
    }
  } catch (error) {
    console.error('Error updating user profile theme:', error);
  }

  logStore.logSystem('Theme locked to dark mode');
}
