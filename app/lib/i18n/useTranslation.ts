import { useStore } from '@nanostores/react';
import { languageStore } from './languageStore';
import { translations, type Language } from './translations';

export function useTranslation() {
  const currentLanguage = useStore(languageStore);

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[currentLanguage];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English if key not found
        value = translations.en;

        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            return key; // Return key if not found in fallback
          }
        }
        break;
      }
    }

    return typeof value === 'string' ? value : key;
  };

  const setLanguage = (language: Language) => {
    languageStore.set(language);
    localStorage.setItem('snapweb_language', language);

    // Update document direction and lang attribute
    const html = document.documentElement;
    html.setAttribute('lang', language);
    html.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
  };

  const isRTL = currentLanguage === 'ar';

  return {
    t,
    currentLanguage,
    setLanguage,
    isRTL,
  };
}
