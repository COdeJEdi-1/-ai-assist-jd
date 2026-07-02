import { Calendar, Filter } from 'lucide-react';
import { Button } from '../components/ui/Button';
import {
  AnalyticsOverviewCards,
  ScreeningPerformanceCards,
  CampaignVolumeChart,
  OutcomeDonutChart,
  RecentCampaignTable,
  AnalyticsEmptyState,
} from '../components/analytics/Charts';
import { useApp } from '../context/AppContext';
import { buildAggregatedAnalytics } from '../utils/analyticsData';

export function AnalyticsPage() {
  const { campaignReports, dashboardStats, hasActiveCampaign, isCampaignRunning, liveCandidates } =
    useApp();
  const analytics = buildAggregatedAnalytics(
    campaignReports,
    dashboardStats,
    hasActiveCampaign,
    isCampaignRunning,
    liveCandidates,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-heading text-gray-900">Screening Analytics</h2>
          <p className="mt-1 text-sm text-grey-secondary">
            Track AI voice screening performance, conversion rates, and campaign outcomes across
            your hiring pipeline.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary">
            <Filter className="h-4 w-4" strokeWidth={1.75} />
            Filter
          </Button>
          <Button variant="secondary">
            <Calendar className="h-4 w-4" strokeWidth={1.75} />
            Date Range
          </Button>
        </div>
      </div>

      {!analytics.hasData ? (
        <AnalyticsEmptyState />
      ) : (
        <>
          <section>
            <h2 className="mb-6 text-sm font-button uppercase tracking-wider text-grey-secondary">
              Overview
            </h2>
            <AnalyticsOverviewCards />
          </section>

          <section>
            <h2 className="mb-6 text-sm font-button uppercase tracking-wider text-grey-secondary">
              Screening Performance
            </h2>
            <ScreeningPerformanceCards />
          </section>

          <section>
            <h2 className="mb-6 text-sm font-button uppercase tracking-wider text-grey-secondary">
              Trends &amp; Outcomes
            </h2>
            <div className="grid-12">
              <CampaignVolumeChart />
              <OutcomeDonutChart />
            </div>
          </section>

          <section>
            <RecentCampaignTable />
          </section>
        </>
      )}
    </div>
  );
}
