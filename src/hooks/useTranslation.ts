import { useParams } from 'react-router-dom';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import pt from '../locales/pt.json';
import de from '../locales/de.json';
import it from '../locales/it.json';
import ru from '../locales/ru.json';
import ja from '../locales/ja.json';
import zh from '../locales/zh.json';
import ko from '../locales/ko.json';

const locales: Record<string, any> = { en, es, fr, pt, de, it, ru, ja, zh, ko };

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
