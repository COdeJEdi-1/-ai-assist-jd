import { useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NotificationDropdown } from './NotificationDropdown';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 flex h-header items-center border-b border-grey-border bg-surface-card px-8">
      <div className="relative flex w-full items-center justify-between">
        <div className="flex w-[120px] shrink-0 items-center gap-4 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-maroon">
            <span className="text-sm font-heading text-white">A</span>
          </div>
        </div>

        <h1 className="pointer-events-none absolute left-1/2 max-w-[50%] -translate-x-1/2 truncate text-center text-lg font-heading text-gray-900 lg:text-xl">
          {title}
        </h1>

        <div className="relative z-10 ml-auto flex shrink-0 items-center gap-2">
          <NotificationDropdown />

          <button
            type="button"
            className="cursor-pointer rounded-xl px-3 py-2 text-grey-secondary transition-colors hover:bg-surface-bg"
            aria-label="Profile"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-maroon/10">
                <User className="h-4 w-4 text-maroon" strokeWidth={1.75} />
              </div>
              <span className="hidden text-sm font-button text-gray-800 sm:inline">
                {user?.name ?? 'User'}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="cursor-pointer rounded-xl p-2.5 text-grey-secondary transition-colors hover:bg-red-50 hover:text-status-error"
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  );
}
