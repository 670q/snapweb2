import { en } from './en';
import { ar } from './ar';

export const translations = {
  en,
  ar,
};

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof en;

export { en, ar };
export type { TranslationKeys } from './en';
