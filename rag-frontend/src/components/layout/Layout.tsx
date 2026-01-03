import { Outlet, useOutletContext } from 'react-router-dom';
import { useState, useEffect } from 'react';

interface LayoutContext {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

export function Layout() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
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