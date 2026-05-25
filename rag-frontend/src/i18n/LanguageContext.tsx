import { createContext, useState, useEffect } from 'react';

export type Lang = 'en' | 'de' | 'pl' | 'no' | 'ar';

interface LanguageContextValue {
  lang: Lang;
  changeLang: (l: Lang) => void;
  dir: 'ltr' | 'rtl';
}

export const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  changeLang: () => {},
  dir: 'ltr',
});

const VALID_LANGS: Lang[] = ['en', 'de', 'pl', 'no', 'ar'];

function detectLang(): Lang {
  const stored = localStorage.getItem('app_language') as Lang | null;
  if (stored && VALID_LANGS.includes(stored)) return stored;
  const browser = navigator.language.split('-')[0];
  if (VALID_LANGS.includes(browser as Lang)) return browser as Lang;
  return 'en';
}

function applyDirection(lang: Lang) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lang;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(detectLang);

  useEffect(() => {
    applyDirection(lang);
  }, []);

  const changeLang = (l: Lang) => {
    localStorage.setItem('app_language', l);
    localStorage.removeItem('answer_language');
    setLang(l);
    applyDirection(l);
  };

  return (
    <LanguageContext.Provider value={{ lang, changeLang, dir: lang === 'ar' ? 'rtl' : 'ltr' }}>
      {children}
    </LanguageContext.Provider>
  );
}
