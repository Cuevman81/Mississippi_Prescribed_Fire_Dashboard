'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  CloudSun,
  Clock,
  Wind,
  Flame,
  FileText,
  Droplets,
  ShieldCheck,
  Printer,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Forecast', href: '/forecast', icon: CloudSun },
  { label: 'Burn Windows', href: '/burn-windows', icon: Clock },
  { label: 'Air Quality', href: '/air-quality', icon: Wind },
  { label: 'Fire & Smoke', href: '/fire-smoke', icon: Flame },
  { label: 'Permits', href: '/permits', icon: FileText },
  { label: 'Drought', href: '/drought', icon: Droplets },
  { label: 'Safety', href: '/safety', icon: ShieldCheck },
  { label: 'Print Summary', href: '/print', icon: Printer },
];

export function MobileSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-slate-900 text-white p-0">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Flame className="h-6 w-6 text-orange-400" />
            <div>
              <h1 className="font-bold text-sm">Prescribed Fire</h1>
              <p className="text-xs text-slate-400">Weather Dashboard v3.0</p>
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
