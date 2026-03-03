'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-white min-h-screen">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Flame className="h-6 w-6 text-orange-400" />
          <div>
            <h1 className="font-bold text-sm leading-tight">Prescribed Fire</h1>
            <p className="text-xs text-slate-400">Weather Dashboard v3.0</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
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

        <div className="pt-6 px-3">
          <div className="pt-4 border-t border-slate-700/50">
            <p className="text-xs text-slate-400 font-medium">
              Mississippi DEQ
            </p>
            <p className="text-[10px] text-slate-500 mt-1 mb-3">
              Data: NWS, AirNow, NOAA, MFC
            </p>
            <div className="pt-3 border-t border-slate-700/50">
              <p className="text-[10px] text-slate-400 mb-1">For bugs or issues, contact:</p>
              <a href="mailto:RCuevas@mdeq.ms.gov" className="text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors block">
                Rodney Cuevas
              </a>
              <a href="mailto:RCuevas@mdeq.ms.gov" className="text-[10px] text-slate-500 hover:text-slate-400 transition-colors block">
                RCuevas@mdeq.ms.gov
              </a>
            </div>
          </div>
        </div>
      </nav>
    </aside>
  );
}
