import { atom } from 'nanostores';
import type { Language } from './translations';

// Get initial language from localStorage or default to English
const getInitialLanguage = (): Language => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('snapweb_language');

    if (stored && (stored === 'en' || stored === 'ar')) {
      return stored as Language;
    }

    // Detect browser language
    const browserLang = navigator.language.toLowerCase();

    if (browserLang.startsWith('ar')) {
      return 'ar';
    }
  }

  return 'en';
};

export const languageStore = atom<Language>(getInitialLanguage());

// Initialize language settings on store creation
if (typeof window !== 'undefined') {
  const currentLang = languageStore.get();
  const html = document.documentElement;
  html.setAttribute('lang', currentLang);
  html.setAttribute('dir', currentLang === 'ar' ? 'rtl' : 'ltr');
}
