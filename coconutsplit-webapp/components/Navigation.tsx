'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function Navigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const groupId = searchParams.get('group_id');

  if (!groupId) return null;

  const links = [
    { href: `/?group_id=${groupId}`, label: 'Expenses' },
    { href: `/add_expense?group_id=${groupId}`, label: 'Add Expense' },
    { href: `/settlements?group_id=${groupId}`, label: 'Settlements' },
  ];

  return (
    <nav className="bg-white shadow-sm mb-8">
      <div className="container mx-auto px-4">
        <div className="flex space-x-4 py-3">
          {links.map((link) => {
            const isActive = pathname === link.href.split('?')[0];
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
} 