import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { useApp } from '../../context/AppContext';

export function LiveCandidateTable() {
  const { liveCandidates } = useApp();

  return (
    <Card className="animate-slide-up overflow-hidden">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-heading text-gray-900">Live Candidate Table</h3>
        <span className="flex items-center gap-1.5 text-xs text-status-success font-button">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-status-success" />
          </span>
          Live
        </span>
      </div>
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-grey-border">
              <th className="pb-3 pr-4 font-button text-grey-secondary">Candidate</th>
              <th className="pb-3 pr-4 font-button text-grey-secondary">Phone</th>
              <th className="pb-3 font-button text-grey-secondary">Status</th>
            </tr>
          </thead>
          <tbody>
            {liveCandidates.map((candidate) => (
              <tr
                key={candidate.id}
                className="border-b border-grey-border/60 transition-colors last:border-0 hover:bg-surface-bg/80"
              >
                <td className="py-4 pr-4 font-button text-gray-900">{candidate.name}</td>
                <td className="py-4 pr-4 text-grey-secondary">{candidate.phone}</td>
                <td className="py-4">
                  <StatusBadge
                    status={candidate.status}
                    label={candidate.omnidimCallStatus}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

