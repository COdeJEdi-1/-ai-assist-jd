import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadSection } from '../components/dashboard/UploadSection';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Sparkles, AlertCircle, FolderPlus, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { downloadCandidateTemplate } from '../utils/candidateTemplate';

export function NewCampaignPage() {
  const navigate = useNavigate();
  const { uploadedFile, startCampaign } = useApp();
  const [campaignName, setCampaignName] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dispatchSummary, setDispatchSummary] = useState({ dispatched: 0, failed: 0 });
  const [dispatchProgress, setDispatchProgress] = useState('');

  const runCampaign = async (name: string) => {
    setStarting(true);
    setError(null);
    setDispatchProgress('Preparing calls...');

    try {
      const result = await startCampaign(name, (current, total, candidateName) => {
        setDispatchProgress(`Dispatching call ${current} of ${total} — ${candidateName} (5s gap between calls)`);
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to start AI screening campaign.');
        if (result.errors?.length) {
          setError(`${result.error}\n${result.errors.slice(0, 3).join('\n')}`);
        }
        return;
      }

      setDispatchSummary({ dispatched: result.dispatched, failed: result.failed });
      setShowSuccessModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error starting campaign.');
    } finally {
      setStarting(false);
      setDispatchProgress('');
    }
  };

  const handleStartClick = () => {
    if (!uploadedFile?.validated) {
      setShowUploadModal(true);
      return;
    }

    runCampaign(campaignName.trim());
  };

  const canStart = Boolean(campaignName.trim());

  return (
    <div className="space-y-8">
      <Card className="animate-slide-up">
        <h2 className="text-lg font-heading text-gray-900">Create New Campaign</h2>
        <p className="mt-2 text-sm text-grey-secondary">
          Upload candidate data and start your AI voice screening campaign.
        </p>
      </Card>

      <section>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-button uppercase tracking-wider text-grey-secondary">
            Step 1 — Upload Candidates
          </h2>
          <Button variant="secondary" onClick={downloadCandidateTemplate}>
            <Download className="h-4 w-4" strokeWidth={1.75} />
            Download Excel Template
          </Button>
        </div>
        <UploadSection syncWithContext />
        {uploadedFile && (
          <p className="mt-3 text-sm text-status-success font-button animate-fade-in">
            ✓ File ready — {uploadedFile.candidatesFound} candidates validated from your Excel
          </p>
        )}
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-status-error animate-fade-in whitespace-pre-line">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.75} />
          <span>{error}</span>
        </div>
      )}

      {starting && dispatchProgress && (
        <div className="rounded-card border border-maroon/20 bg-maroon/5 px-4 py-3 text-sm text-maroon font-button animate-fade-in">
          {dispatchProgress}
        </div>
      )}

      <Card className="animate-slide-up">
        <h2 className="text-sm font-button uppercase tracking-wider text-grey-secondary">
          Step 2 — Campaign Name
        </h2>
        <div className="mt-6">
          <label htmlFor="campaign-name" className="mb-2 block text-sm font-button text-gray-800">
            Campaign Name <span className="text-status-error">*</span>
          </label>
          <input
            id="campaign-name"
            type="text"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="e.g. Senior Software Engineer — Q2 Hiring"
            className="w-full rounded-input border border-grey-border bg-white px-4 py-3 text-sm transition-colors focus:border-maroon focus:outline-none focus:ring-2 focus:ring-maroon/20"
          />
          {!canStart && (
            <p className="mt-3 text-sm text-grey-secondary">
              Enter campaign name to start AI screening.
            </p>
          )}
        </div>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="secondary" onClick={() => navigate('/')} disabled={starting}>
          Cancel
        </Button>
        <Button onClick={handleStartClick} loading={starting} disabled={!canStart}>
          <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          Start AI Screening
        </Button>
      </div>

      {/* Upload required modal */}
      <Modal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Candidates First"
        description="You need to upload and validate a candidate Excel file before starting AI screening."
        primaryAction={{
          label: 'Got it',
          onClick: () => setShowUploadModal(false),
        }}
      >
        <div className="mt-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-maroon/10">
            <FolderPlus className="h-7 w-7 text-maroon" strokeWidth={1.75} />
          </div>
        </div>
      </Modal>

      <Modal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        showSuccessIcon
        title="Campaign Started Successfully"
        description={
          <>
            <p>
              OmniDimension AI agent has dispatched <strong>{dispatchSummary.dispatched}</strong>{' '}
              outbound call{dispatchSummary.dispatched !== 1 ? 's' : ''}.
            </p>
            {dispatchSummary.failed > 0 && (
              <p className="mt-2 text-status-warning">
                {dispatchSummary.failed} call{dispatchSummary.failed !== 1 ? 's' : ''} failed to
                dispatch.
              </p>
            )}
            <p className="mt-2">
              Track progress and download your report from the Reports page once the campaign
              completes.
            </p>
            <p className="mt-2">
              The structured report will be available about 30 seconds after all calls finish.
            </p>
          </>
        }
        primaryAction={{
          label: 'Go to Reports',
          onClick: () => {
            setShowSuccessModal(false);
            navigate('/reports');
          },
        }}
        secondaryAction={{
          label: 'Cancel',
          onClick: () => setShowSuccessModal(false),
        }}
      />
    </div>
  );
}
