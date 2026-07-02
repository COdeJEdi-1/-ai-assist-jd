import {
  Bot,
  Globe,
  Gauge,
  Phone,
  Clock,
  Wifi,
} from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { useApp, formatAgentTime } from '../context/AppContext';
import { getConcurrentCallLimit } from '../services/omnidimension';

export function AIAgentCard() {
  const { isCampaignRunning, agentRunningSeconds } = useApp();
  const concurrentCalls = getConcurrentCallLimit();

  return (
    <Card className="fixed bottom-8 right-8 z-40 w-80 animate-slide-up shadow-card-hover">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-maroon/10">
            <Bot className="h-5 w-5 text-maroon" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="font-heading text-gray-900">AI Voice Agent</h3>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                {isCampaignRunning && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-success opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    isCampaignRunning ? 'bg-status-success' : 'bg-grey-secondary'
                  }`}
                />
              </span>
              <span
                className={`text-xs font-button ${
                  isCampaignRunning ? 'text-status-success' : 'text-grey-secondary'
                }`}
              >
                {isCampaignRunning ? 'Online' : 'Idle'}
              </span>
            </div>
          </div>
        </div>
        <Badge variant={isCampaignRunning ? 'running' : 'default'}>
          {isCampaignRunning ? 'Active' : 'Standby'}
        </Badge>
      </div>

      <div className="space-y-3 border-t border-grey-border pt-4">
        <AgentRow icon={Wifi} label="Voice" value="Professional Female" />
        <AgentRow icon={Globe} label="Language" value="English" />
        <AgentRow icon={Gauge} label="Speaking Speed" value="0.9x" />
        <AgentRow icon={Phone} label="Concurrent Calls" value={String(concurrentCalls)} />
        <AgentRow icon={Clock} label="Running Time" value={formatAgentTime(agentRunningSeconds)} />
      </div>
    </Card>
  );
}

function AgentRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-grey-secondary">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
        <span>{label}</span>
      </div>
      <span className="font-button text-gray-800">{value}</span>
    </div>
  );
}
