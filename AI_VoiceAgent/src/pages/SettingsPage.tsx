import { Bell, Globe, Mic, Shield, User } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const settingsSections = [
  {
    title: 'Profile Settings',
    icon: User,
    fields: [
      { label: 'Full Name', value: 'Manav Raval', type: 'text' },
      { label: 'Email', value: 'manav.raval@arvindgcc.com', type: 'email' },
      { label: 'Department', value: 'Human Resources', type: 'text' },
    ],
  },
  {
    title: 'AI Agent Preferences',
    icon: Mic,
    fields: [
      { label: 'Default Voice', value: 'Professional Female', type: 'select' },
      { label: 'Speaking Speed', value: '0.9x', type: 'select' },
      { label: 'Concurrent Calls', value: '4', type: 'number' },
    ],
  },
  {
    title: 'Notifications',
    icon: Bell,
    fields: [
      { label: 'Email on Campaign Complete', value: 'Enabled', type: 'toggle' },
      { label: 'Daily Summary Report', value: 'Enabled', type: 'toggle' },
      { label: 'Failed Call Alerts', value: 'Enabled', type: 'toggle' },
    ],
  },
  {
    title: 'Language & Region',
    icon: Globe,
    fields: [
      { label: 'Language', value: 'English', type: 'select' },
      { label: 'Timezone', value: 'Asia/Kolkata (IST)', type: 'select' },
    ],
  },
  {
    title: 'Security',
    icon: Shield,
    fields: [
      { label: 'Two-Factor Authentication', value: 'Enabled', type: 'toggle' },
      { label: 'Session Timeout', value: '30 minutes', type: 'select' },
    ],
  },
];

export function SettingsPage() {
  return (
    <div className="space-y-8">
      {settingsSections.map((section, i) => (
        <Card
          key={section.title}
          className="animate-slide-up"
          {...({ style: { animationDelay: `${i * 60}ms`, animationFillMode: 'both' } } as object)}
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-maroon/8">
              <section.icon className="h-5 w-5 text-maroon" strokeWidth={1.75} />
            </div>
            <h2 className="font-heading text-gray-900">{section.title}</h2>
          </div>

          <div className="space-y-4">
            {section.fields.map((field) => (
              <div
                key={field.label}
                className="flex flex-col gap-2 border-b border-grey-border/60 pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <label className="text-sm font-button text-gray-800">{field.label}</label>
                {field.type === 'toggle' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-status-success font-button">{field.value}</span>
                    <div className="h-6 w-11 rounded-full bg-maroon p-0.5">
                      <div className="h-5 w-5 translate-x-5 rounded-full bg-white shadow-sm transition-transform" />
                    </div>
                  </div>
                ) : field.type === 'select' ? (
                  <select className="rounded-input border border-grey-border bg-white px-4 py-2 text-sm text-grey-secondary focus:border-maroon focus:outline-none focus:ring-2 focus:ring-maroon/20">
                    <option>{field.value}</option>
                  </select>
                ) : (
                  <input
                    type={field.type}
                    defaultValue={field.value}
                    className="w-full rounded-input border border-grey-border bg-white px-4 py-2 text-sm sm:max-w-xs focus:border-maroon focus:outline-none focus:ring-2 focus:ring-maroon/20"
                  />
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}

      <div className="flex justify-end gap-4">
        <Button variant="secondary">Reset to Defaults</Button>
        <Button>Save Changes</Button>
      </div>
    </div>
  );
}
