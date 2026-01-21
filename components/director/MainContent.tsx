"use client";

import { useSidebar } from "./SidebarContext";

export function MainContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();

  return (
    <main
      className={`transition-all duration-300 min-h-screen bg-gray-100 pt-16 lg:pt-0 ${
        isCollapsed ? "lg:ml-16" : "lg:ml-64"
      }`}
    >
      <div className="mx-auto max-w-7xl py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}
