import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/new-campaign': 'New Campaign',
  '/reports': 'Reports',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
  '/help': 'Help & Support',
};

export function Layout() {
  const location = useLocation();
  const title = pageTitles[location.pathname] ?? 'Dashboard';

  return (
    <div className="min-h-screen bg-surface-bg">
      <Sidebar />
      <div className="ml-sidebar">
        <Header title={title} />
        <main className="layout-container py-8 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
