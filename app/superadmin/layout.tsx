import type { Metadata } from 'next';
import '../../app/globals.css';

export const metadata: Metadata = {
  title: 'SuperAdmin · Tamiz AMC',
  robots: 'noindex,nofollow,noarchive',
};

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
