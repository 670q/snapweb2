import { useTranslation } from '~/lib/i18n';
import { classNames } from '~/utils/classNames';
import type { Language } from '~/lib/i18n';

interface LanguageToggleProps {
  className?: string;
}

export function LanguageToggle({ className }: LanguageToggleProps) {
  const { t, currentLanguage, setLanguage } = useTranslation();

  const toggleLanguage = () => {
    const newLanguage: Language = currentLanguage === 'en' ? 'ar' : 'en';
    setLanguage(newLanguage);
  };

  return (
    <button
      onClick={toggleLanguage}
      className={classNames(
        'flex items-center gap-2 px-3 py-2 rounded-lg',
        'bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3',
        'border border-bolt-elements-borderColor',
        'text-bolt-elements-textPrimary hover:text-bolt-elements-textPrimary',
        'transition-all duration-200',
        'text-sm font-medium',
        className,
      )}
      title={t('language.selectLanguage')}
    >
      <div className="i-ph:translate text-lg" />
      <span className="hidden sm:inline">{currentLanguage === 'en' ? 'العربية' : 'English'}</span>
    </button>
  );
}
