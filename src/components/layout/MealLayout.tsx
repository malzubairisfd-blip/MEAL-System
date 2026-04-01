// components/layout/MealLayout.tsx
import { Sidebar } from "./Sidebar";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";


export function MealLayout({ children }: { children: React.ReactNode }) {
  const { direction } = useLanguage();
  return (
    <div className="flex min-h-screen bg-bg text-text" dir={direction}>
      <Sidebar />
      <main className={cn(
        "flex-1 px-6 py-8 space-y-8",
        direction === 'rtl' ? 'md:mr-64' : 'md:ml-64'
      )}>
        {children}
      </main>
    </div>
  );
}
