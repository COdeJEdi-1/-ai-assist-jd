import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FolderPlus,
  FileBarChart,
  LineChart,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ArvindGccBrand } from "../brand/ArvindGccBrand";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/new-campaign", label: "New Campaign", icon: FolderPlus },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/analytics", label: "Analytics", icon: LineChart },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help", icon: HelpCircle },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-sidebar flex-col border-r border-grey-border bg-surface-card">
      <div className="flex h-header items-center border-b border-grey-border px-6">
        <ArvindGccBrand variant="light" />
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6">
        <ul className="space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to;
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  className={`
                    flex items-center gap-3 rounded-full px-4 py-3 text-sm font-button transition-all duration-200
                    ${
                      isActive
                        ? "bg-maroon text-white shadow-sm"
                        : "text-grey-secondary hover:bg-surface-bg hover:text-gray-900"
                    }
                  `}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                  {label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-grey-border p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-full px-4 py-3 text-sm font-button text-grey-secondary transition-colors hover:bg-red-50 hover:text-status-error"
        >
          <LogOut className="h-5 w-5" strokeWidth={1.75} />
          Logout
        </button>
      </div>
    </aside>
  );
}
