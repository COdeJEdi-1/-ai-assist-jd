import { BookOpen, MessageCircle, Mail, Phone, ExternalLink } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const helpItems = [
  {
    title: 'Getting Started Guide',
    description: 'Learn how to create campaigns, upload candidates, and monitor AI screening calls.',
    icon: BookOpen,
    action: 'Read Guide',
  },
  {
    title: 'Live Chat Support',
    description: 'Connect with our HR platform support team for real-time assistance.',
    icon: MessageCircle,
    action: 'Start Chat',
  },
  {
    title: 'Email Support',
    description: 'Reach out to support@arvindgcc.com for detailed inquiries.',
    icon: Mail,
    action: 'Send Email',
  },
  {
    title: 'Phone Support',
    description: 'Call +91 80 4123 4567 during business hours (9 AM – 6 PM IST).',
    icon: Phone,
    action: 'Call Now',
  },
];

const faqs = [
  {
    q: 'What file formats are supported for candidate upload?',
    a: 'We support .xlsx, .xls, and .csv file formats for candidate data upload.',
  },
  {
    q: 'How many concurrent calls can the AI agent handle?',
    a: 'The default configuration supports up to 4 concurrent calls. This can be adjusted via VITE_OMNIDIM_CONCURRENT_CALLS in Settings.',
  },
  {
    q: 'When will I receive the campaign report?',
    a: 'Structured reports are emailed automatically once the campaign completes processing all candidates.',
  },
  {
    q: 'Where can I view my campaign report?',
    a: 'Go to the Reports page. Your report is generated about 30 seconds after the campaign completes, and you will see a notification when it is ready to download.',
  },
];

export function HelpPage() {
  return (
    <div className="space-y-8">
      <div className="grid-12">
        {helpItems.map((item, i) => (
          <div key={item.title} className="col-span-12 sm:col-span-6">
            <Card
              hover
              className="h-full animate-slide-up"
              {...({ style: { animationDelay: `${i * 60}ms`, animationFillMode: 'both' } } as object)}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-maroon/8">
                <item.icon className="h-5 w-5 text-maroon" strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 font-heading text-gray-900">{item.title}</h3>
              <p className="mt-2 text-sm text-grey-secondary">{item.description}</p>
              <Button variant="secondary" className="mt-4">
                {item.action}
                <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            </Card>
          </div>
        ))}
      </div>

      <Card className="animate-slide-up">
        <h2 className="mb-6 font-heading text-gray-900">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-xl border border-grey-border p-4 transition-colors open:bg-surface-bg"
            >
              <summary className="cursor-pointer list-none font-button text-gray-900 marker:content-none">
                <span className="flex items-center justify-between">
                  {faq.q}
                  <span className="text-maroon transition-transform group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-grey-secondary">{faq.a}</p>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
