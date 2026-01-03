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

// Toast utility functions
export const toast = {
  success: (message: string) => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.innerHTML = `
      <svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
      <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Trigger reflow to restart animation
    toast.getBoundingClientRect();
    toast.classList.add('toast-show');
    
    setTimeout(() => {
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },
  
  error: (message: string) => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast toast-error';
    toast.innerHTML = `
      <svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
      <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Trigger reflow to restart animation
    toast.getBoundingClientRect();
    toast.classList.add('toast-show');
    
    setTimeout(() => {
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },
  
  info: (message: string) => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast toast-info';
    toast.innerHTML = `
      <svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Trigger reflow to restart animation
    toast.getBoundingClientRect();
    toast.classList.add('toast-show');
    
    setTimeout(() => {
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },
  
  warning: (message: string) => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast toast-warning';
    toast.innerHTML = `
      <svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
      </svg>
      <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Trigger reflow to restart animation
    toast.getBoundingClientRect();
    toast.classList.add('toast-show');
    
    setTimeout(() => {
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};