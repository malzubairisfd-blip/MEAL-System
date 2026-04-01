// components/layout/Sidebar.tsx
"use client";
import { Flame, Database, Shield, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { direction } = useLanguage();
  const navItems = [
    { icon: <Flame size={18} />, name: 'Overview' },
    { icon: <Database size={18} />, name: 'Firestore' },
    { icon: <Shield size={18} />, name: 'Authentication' },
    { icon: <Settings size={18} />, name: 'Settings' },
  ];

  return (
    <aside 
      className={cn(
        "fixed inset-y-0 w-64 bg-surface hidden md:flex flex-col",
        direction === 'rtl' ? "right-0 border-l border-white/5" : "left-0 border-r border-white/5"
      )}
    >
      <div className="px-6 py-4 font-semibold text-sm tracking-wide">
        🔥 MEAL Dashboard
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item, i) => (
          <motion.div
            key={i}
            whileHover={{ backgroundColor: "rgba(255,255,255,0.06)" }}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted cursor-pointer"
          >
            {item.icon}
            {item.name}
          </motion.div>
        ))}
      </nav>
    </aside>
  );
}
