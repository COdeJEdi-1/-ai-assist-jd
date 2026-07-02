import {
  Users,
  PhoneCall,
  Phone,
  Clock,
  PhoneOff,
  UserCheck,
} from 'lucide-react';
import { StatCard } from '../ui/Card';
import { useApp } from '../../context/AppContext';

export function DashboardCards() {
  const { dashboardStats } = useApp();

  const cards = [
    { title: 'Total Candidates', value: dashboardStats.totalCandidates.toLocaleString(), icon: Users, delay: 0 },
    { title: 'Completed Calls', value: dashboardStats.completedCalls.toLocaleString(), icon: PhoneCall, delay: 50 },
    { title: 'Active Calls', value: dashboardStats.activeCalls, icon: Phone, delay: 100 },
    { title: 'Pending Calls', value: dashboardStats.pendingCalls, icon: Clock, delay: 150 },
    { title: 'Failed Calls', value: dashboardStats.failedCalls, icon: PhoneOff, delay: 200 },
    { title: 'Qualified Candidates', value: dashboardStats.qualifiedCandidates, icon: UserCheck, delay: 250 },
  ];

  return (
    <div className="grid-12">
      {cards.map((card) => (
        <div key={card.title} className="col-span-12 sm:col-span-6 lg:col-span-4 xl:col-span-2">
          <StatCard {...card} />
        </div>
      ))}
    </div>
  );
}
