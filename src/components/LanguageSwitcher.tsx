import React from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'pt', name: 'Português' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'ru', name: 'Русский' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'ko', name: '한국어' },
];

export const LanguageSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useParams();

  const handleLanguageChange = (newLang: string) => {
    // Replace the language segment in the current path
    const pathSegments = location.pathname.split('/').filter(Boolean);
    
    if (pathSegments.length > 0 && LANGUAGES.some(l => l.code === pathSegments[0])) {
      pathSegments[0] = newLang;
    } else {
      pathSegments.unshift(newLang);
    }

    navigate(`/${pathSegments.join('/')}`);
  };

  return (
    <div className="language-switcher">
      {LANGUAGES.map((l, index) => (
        <React.Fragment key={l.code}>
          <button 
            className={`lang-link ${lang === l.code ? 'active' : ''}`}
            onClick={() => handleLanguageChange(l.code)}
          >
            {l.name}
          </button>
          {index < LANGUAGES.length - 1 && <span className="separator">|</span>}
        </React.Fragment>
      ))}
    </div>
  );
};