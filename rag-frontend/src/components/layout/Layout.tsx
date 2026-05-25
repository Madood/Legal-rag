import { Outlet, useOutletContext } from 'react-router-dom';
import { useState, useEffect } from 'react';

interface LayoutContext {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

export function Layout() {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('darkMode') === 'true' ||
          window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString());
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <div className="min-h-screen">
      <Outlet context={{ darkMode, setDarkMode }} />
    </div>
  );
}

export function useLayoutContext() {
  return useOutletContext<LayoutContext>();
}