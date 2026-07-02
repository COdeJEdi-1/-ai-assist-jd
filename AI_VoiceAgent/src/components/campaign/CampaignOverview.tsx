import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ProgressBar } from '../ui/StatusBadge';
import {
  Users,
  CheckCircle2,
  Phone,
  Clock,
  RotateCcw,
  Timer,
} from 'lucide-react';
import { StatCard } from '../ui/Card';
import { useApp } from '../../context/AppContext';

export function CampaignHeader() {
  const { campaign } = useApp();

  return (
    <Card className="animate-slide-up">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-button text-grey-secondary">{campaign.id}</span>
            <Badge variant={campaign.status === 'running' ? 'running' : 'success'}>
              {campaign.status === 'running' ? 'Running' : 'Completed'}
            </Badge>
          </div>
          <h2 className="mt-2 text-2xl font-heading text-gray-900">{campaign.name}</h2>
          <div className="mt-3 flex flex-wrap gap-6 text-sm text-grey-secondary">
            <span>
              Created By: <span className="font-button text-gray-800">{campaign.createdBy}</span>
            </span>
            <span>
              Started At: <span className="font-button text-gray-800">{campaign.startedAt}</span>
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function CampaignKPIs() {
  const { campaign } = useApp();

  const kpis = [
    { title: 'Total Candidates', value: campaign.totalCandidates, icon: Users },
    { title: 'Completed', value: campaign.completed, icon: CheckCircle2 },
    { title: 'In Progress', value: campaign.running, icon: Phone },
    { title: 'Pending', value: campaign.queued, icon: Clock },
    { title: 'No Answer', value: campaign.retries, icon: RotateCcw },
    { title: 'Average Duration', value: campaign.averageDuration, icon: Timer },
  ];

  return (
    <div className="grid-12">
      {kpis.map((kpi, i) => (
        <div key={kpi.title} className="col-span-12 sm:col-span-6 lg:col-span-4 xl:col-span-2">
          <StatCard {...kpi} delay={i * 50} />
        </div>
      ))}
    </div>
  );
}

export function CampaignProgress() {
  const { campaign } = useApp();

  return (
    <Card className="animate-slide-up">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-gray-900">Campaign Progress</h3>
        <span className="text-2xl font-heading text-maroon">{campaign.progress}%</span>
      </div>
      <ProgressBar value={campaign.progress} className="h-4" />
      <p className="mt-3 text-sm text-grey-secondary">
        {campaign.completed} completed · {campaign.retries} no answer · {campaign.failed} failed —{' '}
        {campaign.completed + campaign.retries + campaign.failed} of {campaign.totalCandidates}{' '}
        candidates processed
      </p>
    </Card>
  );
}
