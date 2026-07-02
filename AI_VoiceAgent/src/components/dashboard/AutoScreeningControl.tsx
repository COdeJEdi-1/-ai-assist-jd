import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Upload } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { getAutoCallEnabled, setAutoCallEnabled, uploadQualifiedExcel } from '../../services/autoScreening';

export function AutoScreeningControl() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAutoCallEnabled()
      .then(setEnabled)
      .catch(() => setError('Could not reach the screening backend — is it running on port 3001?'));
  }, []);

  const handleToggle = async () => {
    if (enabled === null) return;
    setToggling(true);
    setError(null);
    try {
      const next = await setAutoCallEnabled(!enabled);
      setEnabled(next);
    } catch {
      setError('Could not update auto-call status');
    } finally {
      setToggling(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMessage(null);
    setError(null);

    try {
      const result = await uploadQualifiedExcel(file);
      setUploadMessage(
        `Dispatching calls for ${result.count} candidate${result.count === 1 ? '' : 's'} from ${file.name}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="animate-slide-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-gray-900">Auto-Screening Calls</h3>
            {enabled !== null && (
              <Badge variant={enabled ? 'success' : 'warning'}>{enabled ? 'Active' : 'Paused'}</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-grey-secondary">
            While active, candidates scoring above the threshold are called automatically the moment
            they're scored. Pause it and upload a Qualified-for-AI-Call Excel to trigger calls manually instead.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={enabled ? 'secondary' : 'primary'}
            onClick={handleToggle}
            loading={toggling}
            disabled={enabled === null}
          >
            {enabled ? (
              <Pause className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <Play className="h-4 w-4" strokeWidth={1.75} />
            )}
            {enabled ? 'Pause Auto-Calling' : 'Resume Auto-Calling'}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} loading={uploading}>
            <Upload className="h-4 w-4" strokeWidth={1.75} />
            Upload Qualified Excel
          </Button>
        </div>
      </div>

      {uploadMessage && <p className="mt-3 text-sm text-status-success">{uploadMessage}</p>}
      {error && <p className="mt-3 text-sm text-status-error">{error}</p>}
    </Card>
  );
}
