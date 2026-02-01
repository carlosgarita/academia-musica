"use client";

export function ProfessorMainContent({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gray-100 pt-16 lg:pt-0 lg:pl-64">
      <div className="mx-auto max-w-7xl py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}
