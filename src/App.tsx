/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { FluentUninstallerSimulator } from './components/FluentUninstallerSimulator';

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sift_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('sift_theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#000000';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#f1f5f9';
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  return (
    <div className={`w-screen h-screen overflow-hidden flex flex-col font-sans p-0 m-0 select-none transition-colors duration-200 ${
      isDarkMode ? 'bg-black text-white' : 'bg-[#f1f5f9] text-slate-900'
    }`}>
      <div className={`w-full h-full flex flex-col flex-1 overflow-hidden transition-colors duration-200 ${
        isDarkMode ? 'bg-black' : 'bg-[#f1f5f9]'
      }`}>
        <FluentUninstallerSimulator isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />
      </div>
    </div>
  );
}


