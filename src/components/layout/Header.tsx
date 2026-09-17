'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Truck, LayoutDashboard, Users, CreditCard, ShieldCheck } from 'lucide-react';

export default function Header() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/drivers', label: 'Drivers', icon: Users },
    { href: '/payments', label: 'Payment Ledger', icon: CreditCard },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Company Branding */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <Truck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg">
                  NationLinks Dispatch
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Production
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Driver Payment Dashboard</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
