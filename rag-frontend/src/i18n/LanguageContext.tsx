import { createContext, useState } from 'react';

export type Lang = 'en' | 'de' | 'pl' | 'no';

interface LanguageContextValue {
  lang: Lang;
  changeLang: (l: Lang) => void;
}

export const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  changeLang: () => {},
});

function detectLang(): Lang {
  const stored = localStorage.getItem('app_language') as Lang | null;
  if (stored && ['en', 'de', 'pl', 'no'].includes(stored)) return stored;
  const browser = navigator.language.split('-')[0];
  if (['en', 'de', 'pl', 'no'].includes(browser)) return browser as Lang;
  return 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(detectLang);

  const changeLang = (l: Lang) => {
    localStorage.setItem('app_language', l);
    setLang(l);
  };

  return (
    <LanguageContext.Provider value={{ lang, changeLang }}>
      {children}
    </LanguageContext.Provider>
  );
}
