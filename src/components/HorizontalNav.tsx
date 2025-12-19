"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface HorizontalNavProps {
  links: NavLink[];
}

export function HorizontalNav({ links }: HorizontalNavProps) {
  const pathname = usePathname();

  return (
    <nav className="border-b bg-background">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-12 items-center justify-center">
          <div className="flex space-x-4 overflow-x-auto">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium",
                  pathname === link.href
                    ? "bg-muted text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
