import { useParams } from 'react-router-dom';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';

const locales: Record<string, any> = { en, es, fr };

export const useTranslation = () => {
  const { lang = 'en' } = useParams();
  const translations = locales[lang] || locales.en;

  const t = (path: string, defaultValue?: string): string => {
    const keys = path.split('.');
    let value = translations;

    for (const key of keys) {
      value = value?.[key];
    }

    if (value === undefined) {
      // Fallback to English if not found in current locale
      let fallbackValue = locales.en;
      for (const key of keys) {
        fallbackValue = fallbackValue?.[key];
      }
      return fallbackValue || defaultValue || path;
    }

    return value;
  };

  return { t, lang, translations };
};
