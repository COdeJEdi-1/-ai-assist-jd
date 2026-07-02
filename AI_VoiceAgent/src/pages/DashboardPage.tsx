import { DashboardCards } from '../components/dashboard/DashboardCards';
import { AutoScreeningControl } from '../components/dashboard/AutoScreeningControl';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';

export function DashboardPage() {
  const { hasActiveCampaign } = useApp();
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-6 text-sm font-button uppercase tracking-wider text-grey-secondary">
          Overview
        </h2>
        <DashboardCards />
      </section>

      <AutoScreeningControl />

      {!hasActiveCampaign && (
        <Card className="animate-slide-up border-dashed text-center py-10">
          <p className="text-sm text-grey-secondary">
            No campaign running yet. Upload candidates and start AI screening to populate live metrics.
          </p>
          <Button className="mt-4" onClick={() => navigate('/new-campaign')}>
            Start New Campaign
          </Button>
        </Card>
      )}
    </div>
  );
}
