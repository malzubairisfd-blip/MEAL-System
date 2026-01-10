// components/layout/MealLayout.tsx
import { Sidebar } from "./Sidebar";

export function MealLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg text-text">
      <Sidebar />
      <main className="flex-1 px-6 py-8 space-y-8 md:ml-64">
        {children}
      </main>
    </div>
  );
}
