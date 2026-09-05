import React from 'react';

interface HomeShellProps {
  children: React.ReactNode;
}

export const HomeShell: React.FC<HomeShellProps> = ({ children }) => {
  return (
    <div className="w-full min-h-screen bg-[#FAF8F5] text-stone-900 transition-colors">
      {/* 
        Phase 1: Home Page App Shell 
        Structured cleanly to host:
        - Top Header (Location, Brand, Notification)
        - Search & Filter Controls
        - Future Home Content Sections (Phase 2: Hero, Categories, Collections, Bestsellers)
      */}
      <div className="w-full flex flex-col">
        {children}
      </div>
    </div>
  );
};
