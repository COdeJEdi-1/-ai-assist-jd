import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, FileText, Phone, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  href: string;
  unread: boolean;
  icon: 'campaign' | 'report' | 'alert' | 'success';
}

function NotificationIcon({ type }: { type: NotificationItem['icon'] }) {
  const className = 'h-4 w-4 shrink-0';
  switch (type) {
    case 'campaign':
      return <Phone className={`${className} text-maroon`} strokeWidth={1.75} />;
    case 'report':
      return <FileText className={`${className} text-status-info`} strokeWidth={1.75} />;
    case 'alert':
      return <AlertCircle className={`${className} text-status-warning`} strokeWidth={1.75} />;
    default:
      return <CheckCircle2 className={`${className} text-status-success`} strokeWidth={1.75} />;
  }
}

export function NotificationDropdown() {
  const navigate = useNavigate();
  const {
    campaign,
    isCampaignRunning,
    hasActiveCampaign,
    dashboardStats,
    campaignReports,
    pendingReport,
    pendingReportSeconds,
    reportReadyAlert,
    dismissReportReadyAlert,
  } = useApp();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const notifications = useMemo(() => {
    const items: NotificationItem[] = [];

    if (hasActiveCampaign && isCampaignRunning) {
      items.push({
        id: `active-${campaign.id}`,
        title: 'Campaign in progress',
        message: `${campaign.name} — ${campaign.completed} of ${campaign.totalCandidates} calls completed`,
        time: 'Live',
        href: '/reports',
        unread: true,
        icon: 'campaign',
      });
    } else if (hasActiveCampaign && campaign.status === 'completed') {
      if (pendingReport) {
        items.push({
          id: `pending-report-${pendingReport.campaignId}`,
          title: 'Report processing',
          message: `${pendingReport.campaignName} — ready in ${pendingReportSeconds}s`,
          time: 'Processing',
          href: '/reports',
          unread: true,
          icon: 'report',
        });
      } else {
        items.push({
          id: `completed-${campaign.id}`,
          title: 'Campaign completed',
          message: `${campaign.name} finished with ${dashboardStats.completedCalls} completed calls`,
          time: 'Recently',
          href: '/reports',
          unread: true,
          icon: 'success',
        });
      }
    }

    if (dashboardStats.failedCalls > 0 && hasActiveCampaign) {
      items.push({
        id: `failed-${campaign.id}`,
        title: 'Failed calls detected',
        message: `${dashboardStats.failedCalls} call${dashboardStats.failedCalls !== 1 ? 's' : ''} need attention in ${campaign.name}`,
        time: 'Live',
        href: '/reports',
        unread: true,
        icon: 'alert',
      });
    }

    campaignReports.slice(0, 3).forEach((report) => {
      if (report.status !== 'ready') return;
      items.push({
        id: report.id,
        title: 'Report ready',
        message: `${report.campaignName} — download from Reports`,
        time: report.date,
        href: '/reports',
        unread: true,
        icon: 'report',
      });
    });

    return items;
  }, [
    campaign,
    campaignReports,
    dashboardStats.completedCalls,
    dashboardStats.failedCalls,
    hasActiveCampaign,
    isCampaignRunning,
    pendingReport,
    pendingReportSeconds,
  ]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        setReadIds((current) => {
          const updated = new Set(current);
          notifications.forEach((n) => updated.add(n.id));
          return updated;
        });
      }
      return next;
    });
  };

  const handleSelect = (item: NotificationItem) => {
    setOpen(false);
    navigate(item.href);
  };

  const handleReportBubbleClick = () => {
    dismissReportReadyAlert();
    navigate('/reports');
  };

  return (
    <div ref={containerRef} className="relative z-50 flex items-center gap-2">
      {reportReadyAlert && (
        <button
          type="button"
          onClick={handleReportBubbleClick}
          aria-label={`Report ready: ${reportReadyAlert.campaignName}`}
          className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-status-success/40 bg-status-success/10 text-status-success shadow-sm transition-all hover:bg-status-success/20 hover:shadow-md"
        >
          <span className="absolute -left-0.5 -top-0.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-success opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-status-success ring-2 ring-white" />
          </span>
          <FileText className="h-4 w-4" strokeWidth={1.75} />
        </button>
      )}

      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
        className="relative z-10 cursor-pointer rounded-xl p-2.5 text-grey-secondary transition-colors hover:bg-surface-bg hover:text-maroon"
      >
        <Bell className="h-5 w-5 pointer-events-none" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="pointer-events-none absolute right-2 top-2 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-maroon opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-maroon" />
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-card border border-grey-border bg-surface-card shadow-card-hover animate-slide-up"
        >
          <div className="border-b border-grey-border px-4 py-3">
            <p className="font-heading text-gray-900">Notifications</p>
            <p className="text-xs text-grey-secondary">
              {notifications.length === 0
                ? 'You are all caught up'
                : `${unreadCount > 0 ? unreadCount : notifications.length} update${notifications.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-grey-secondary">
              No notifications yet. Start a campaign to see updates here.
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {notifications.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelect(item)}
                    className="flex w-full gap-3 border-b border-grey-border/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface-bg"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-bg">
                      <NotificationIcon type={item.icon} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-button text-gray-900">{item.title}</p>
                      <p className="mt-0.5 text-xs text-grey-secondary line-clamp-2">
                        {item.message}
                      </p>
                      <p className="mt-1 text-[11px] text-grey-secondary">{item.time}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
