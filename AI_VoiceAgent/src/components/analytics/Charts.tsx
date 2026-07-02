import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import {
  LineChart as LineChartIcon,
  Users,
  PhoneCall,
  UserCheck,
  PhoneOff,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { useMemo } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { useApp } from '../../context/AppContext';
import { buildAggregatedAnalytics } from '../../utils/analyticsData';

const tooltipStyle = {
  borderRadius: '10px',
  border: '1px solid #E5E7EB',
  boxShadow: '0px 4px 20px rgba(0,0,0,0.08)',
};

function useAnalyticsData() {
  const {
    campaignReports,
    dashboardStats,
    hasActiveCampaign,
    isCampaignRunning,
    liveCandidates,
    campaign,
  } = useApp();

  const data = useMemo(
    () =>
      buildAggregatedAnalytics(
        campaignReports,
        dashboardStats,
        hasActiveCampaign,
        isCampaignRunning,
        liveCandidates,
      ),
    [campaignReports, dashboardStats, hasActiveCampaign, isCampaignRunning, liveCandidates],
  );

  return { data, campaign, hasActiveCampaign, isCampaignRunning, dashboardStats };
}

export function AnalyticsOverviewCards() {
  const { data } = useAnalyticsData();

  const cards = [
    {
      title: 'Campaigns Run',
      value: data.totalCampaigns.toLocaleString(),
      icon: BarChart3,
      color: 'text-maroon',
    },
    {
      title: 'Candidates Screened',
      value: data.totalCandidates.toLocaleString(),
      icon: Users,
      color: 'text-gray-900',
    },
    {
      title: 'Calls Completed',
      value: data.completedCalls.toLocaleString(),
      icon: PhoneCall,
      color: 'text-status-success',
    },
    {
      title: 'Qualified',
      value: data.qualifiedCandidates.toLocaleString(),
      icon: UserCheck,
      color: 'text-status-success',
    },
    {
      title: 'Failed Calls',
      value: data.failedCalls.toLocaleString(),
      icon: PhoneOff,
      color: 'text-status-error',
    },
    {
      title: 'Completion Rate',
      value: `${data.completionRate}%`,
      icon: TrendingUp,
      color: 'text-maroon',
    },
  ];

  return (
    <div className="grid-12">
      {cards.map((card, i) => (
        <div key={card.title} className="col-span-12 sm:col-span-6 lg:col-span-4 xl:col-span-2">
          <Card
            hover
            className="animate-slide-up"
            {...({ style: { animationDelay: `${i * 50}ms`, animationFillMode: 'both' } } as object)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-heading text-gray-900">{card.value}</p>
                <p className="mt-1 text-sm text-grey-secondary">{card.title}</p>
              </div>
              <card.icon className={`h-8 w-8 ${card.color}`} strokeWidth={1.75} />
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
}

export function ScreeningPerformanceCards() {
  const { data } = useAnalyticsData();

  const items = [
    {
      label: 'Screening Completion',
      value: data.completionRate,
      color: 'bg-status-success',
      hint: `${data.completedCalls} of ${data.totalCandidates} candidates screened`,
    },
    {
      label: 'Qualification Rate',
      value: data.qualificationRate,
      color: 'bg-maroon',
      hint: `${data.qualifiedCandidates} qualified from completed calls`,
    },
    {
      label: 'Call Failure Rate',
      value: data.failureRate,
      color: 'bg-status-error',
      hint: `${data.failedCalls} calls did not complete successfully`,
    },
  ];

  return (
    <div className="grid-12">
      {items.map((item, i) => (
        <div key={item.label} className="col-span-12 md:col-span-4">
          <Card
            className="animate-slide-up"
            {...({ style: { animationDelay: `${i * 75}ms`, animationFillMode: 'both' } } as object)}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-button text-grey-secondary">{item.label}</span>
              <span className="text-lg font-heading text-gray-900">{item.value}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-grey-border">
              <div
                className={`h-full rounded-full ${item.color} transition-all duration-700`}
                style={{ width: `${Math.min(item.value, 100)}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-grey-secondary">{item.hint}</p>
          </Card>
        </div>
      ))}
    </div>
  );
}

export function CampaignVolumeChart() {
  const { data } = useAnalyticsData();

  if (data.campaignTrend.length === 0) {
    return (
      <Card className="animate-slide-up col-span-12 lg:col-span-8">
        <h3 className="mb-2 font-heading text-gray-900">Calls Processed by Campaign</h3>
        <p className="mb-6 text-sm text-grey-secondary">
          Volume across completed and active screening campaigns
        </p>
        <div className="flex h-72 items-center justify-center text-sm text-grey-secondary">
          No campaign data yet
        </div>
      </Card>
    );
  }

  return (
    <Card className="animate-slide-up col-span-12 lg:col-span-8">
      <h3 className="mb-2 font-heading text-gray-900">Calls Processed by Campaign</h3>
      <p className="mb-6 text-sm text-grey-secondary">
        Completed and failed calls per screening campaign
      </p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.campaignTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#5C6166', fontSize: 12 }}
              axisLine={{ stroke: '#E5E7EB' }}
            />
            <YAxis tick={{ fill: '#5C6166', fontSize: 12 }} axisLine={{ stroke: '#E5E7EB' }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="calls" fill="#A61D3A" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function OutcomeDonutChart() {
  const { data } = useAnalyticsData();

  if (data.outcomeBreakdown.length === 0) {
    return (
      <Card className="animate-slide-up col-span-12 lg:col-span-4">
        <h3 className="mb-2 font-heading text-gray-900">Candidate Outcomes</h3>
        <p className="mb-6 text-sm text-grey-secondary">
          Status breakdown across all screening activity
        </p>
        <div className="flex h-72 items-center justify-center text-sm text-grey-secondary">
          No outcome data yet
        </div>
      </Card>
    );
  }

  return (
    <Card className="animate-slide-up col-span-12 lg:col-span-4">
      <h3 className="mb-2 font-heading text-gray-900">Candidate Outcomes</h3>
      <p className="mb-6 text-sm text-grey-secondary">
        Status breakdown across all screening activity
      </p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.outcomeBreakdown}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
            >
              {data.outcomeBreakdown.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              formatter={(value) => <span className="text-xs text-grey-secondary">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function RecentCampaignTable() {
  const { data, campaign, hasActiveCampaign, isCampaignRunning, dashboardStats } = useAnalyticsData();

  const rows =
    hasActiveCampaign && isCampaignRunning
    ? [
        {
          id: campaign.id,
          name: campaign.name,
          date: 'In progress',
          candidates: campaign.totalCandidates,
          completed: campaign.completed,
          failed: dashboardStats.failedCalls,
          qualified: dashboardStats.qualifiedCandidates,
          progress: campaign.progress,
          active: true,
        },
        ...data.recentCampaigns.map((row) => ({ ...row, active: false })),
      ]
    : data.recentCampaigns.map((row) => ({ ...row, active: false }));

  if (rows.length === 0) {
    return null;
  }

  return (
    <Card className="animate-slide-up overflow-hidden">
      <div className="mb-6">
        <h3 className="font-heading text-gray-900">Campaign Performance</h3>
        <p className="mt-1 text-sm text-grey-secondary">
          Summary of recent AI screening campaigns
        </p>
      </div>
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-grey-border">
              {['Campaign', 'Date', 'Candidates', 'Completed', 'Failed', 'Qualified', 'Progress'].map(
                (col) => (
                  <th key={col} className="pb-3 pr-4 font-button text-grey-secondary">
                    {col}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.id}-${row.name}`}
                className="border-b border-grey-border/60 transition-colors last:border-0 hover:bg-surface-bg/80"
              >
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-button text-gray-900">{row.name}</span>
                    {'active' in row && row.active && <Badge variant="running">Live</Badge>}
                  </div>
                  <span className="text-xs text-grey-secondary">{row.id}</span>
                </td>
                <td className="py-4 pr-4 text-grey-secondary">{row.date}</td>
                <td className="py-4 pr-4 text-grey-secondary">{row.candidates}</td>
                <td className="py-4 pr-4 text-grey-secondary">{row.completed}</td>
                <td className="py-4 pr-4 text-grey-secondary">{row.failed}</td>
                <td className="py-4 pr-4 text-grey-secondary">{row.qualified}</td>
                <td className="py-4 pr-4 font-button text-maroon">{row.progress}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function AnalyticsEmptyState() {
  return (
    <Card className="animate-slide-up py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-maroon/10">
        <LineChartIcon className="h-7 w-7 text-maroon" strokeWidth={1.75} />
      </div>
      <h3 className="font-heading text-gray-900">No Analytics Yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-grey-secondary">
        Run an AI screening campaign to populate performance metrics, outcome charts, and campaign
        trends here.
      </p>
    </Card>
  );
}
