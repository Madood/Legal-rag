import { Outlet } from 'react-router-dom';
import { Header } from './Header/Header';
import { useState, useEffect } from 'react';
import './AppLayout.css';

export function AppLayout() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Priority: saved setting > system preference
    const initialDarkMode = savedDarkMode || prefersDark;
    setDarkMode(initialDarkMode);
    
    if (initialDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString());
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="app-layout">
      <Header 
        darkMode={darkMode} 
        onToggleDarkMode={() => setDarkMode(!darkMode)} 
      />
      <main className="main-content">
        <Outlet />
      </main>
      
      {/* Toast Container */}
      <div id="toast-container" className="toast-container"></div>
    </div>
  );
}

// Safe toast helper: never injects message into innerHTML to prevent XSS
function createToastElement(className: string, svgPath: string, message: string): HTMLDivElement {
  const toastEl = document.createElement('div');
  toastEl.className = `toast ${className}`;

  // Static SVG — no user content
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'toast-icon');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('viewBox', '0 0 24 24');
  const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathEl.setAttribute('stroke-linecap', 'round');
  pathEl.setAttribute('stroke-linejoin', 'round');
  pathEl.setAttribute('stroke-width', '2');
  pathEl.setAttribute('d', svgPath);
  svg.appendChild(pathEl);

  // Safe message via textContent (never parsed as HTML)
  const span = document.createElement('span');
  span.className = 'toast-message';
  span.textContent = message;

  toastEl.appendChild(svg);
  toastEl.appendChild(span);
  return toastEl;
}

function showToast(className: string, svgPath: string, message: string) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toastEl = createToastElement(className, svgPath, message);
  container.appendChild(toastEl);
  toastEl.getBoundingClientRect();
  toastEl.classList.add('toast-show');
  setTimeout(() => {
    toastEl.classList.add('toast-hide');
    setTimeout(() => toastEl.remove(), 300);
  }, 3000);
}

// Toast utility functions
export const toast = {
  success: (message: string) => showToast(
    'toast-success',
    'M5 13l4 4L19 7',
    message
  ),
  error: (message: string) => showToast(
    'toast-error',
    'M6 18L18 6M6 6l12 12',
    message
  ),
  info: (message: string) => showToast(
    'toast-info',
    'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    message
  ),
  warning: (message: string) => showToast(
    'toast-warning',
    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z',
    message
  ),
};