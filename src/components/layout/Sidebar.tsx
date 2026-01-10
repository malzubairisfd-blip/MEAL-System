// components/layout/Sidebar.tsx
"use client";
import { Flame, Database, Shield, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

export function Sidebar() {
  const navItems = [
    { icon: <Flame size={18} />, name: 'Overview' },
    { icon: <Database size={18} />, name: 'Firestore' },
    { icon: <Shield size={18} />, name: 'Authentication' },
    { icon: <Settings size={18} />, name: 'Settings' },
  ];

  return (
    <aside className=" fixed inset-y-0 left-0 w-64 bg-surface border-r border-white/5 hidden md:flex flex-col ">
      <div className="px-6 py-4 font-semibold text-sm tracking-wide">
        🔥 MEAL Dashboard
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item, i) => (
          <motion.div
            key={i}
            whileHover={{ backgroundColor: "rgba(255,255,255,0.06)" }}
            className=" flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted cursor-pointer "
          >
            {item.icon}
            {item.name}
          </motion.div>
        ))}
      </nav>
    </aside>
  );
}
