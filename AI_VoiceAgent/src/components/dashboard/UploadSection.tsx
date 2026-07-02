import { useCallback, useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Replace,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { UploadedFile } from '../../types';
import { useApp } from '../../context/AppContext';
import { parseCandidateFile } from '../../utils/parseCandidateFile';

interface UploadSectionProps {
  onUploadComplete?: (file: UploadedFile) => void;
  onUploadClear?: () => void;
  syncWithContext?: boolean;
}

const PREVIEW_ROW_LIMIT = 50;

export function UploadSection({
  onUploadComplete,
  onUploadClear,
  syncWithContext = false,
}: UploadSectionProps) {
  const app = useApp();
  const [localFile, setLocalFile] = useState<UploadedFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadedFile = syncWithContext ? app.uploadedFile : localFile;

  const setUploadedFile = useCallback(
    (file: UploadedFile | null) => {
      if (syncWithContext) {
        app.setUploadedFile(file);
      } else {
        setLocalFile(file);
      }
      if (file) {
        onUploadComplete?.(file);
      } else {
        onUploadClear?.();
      }
    },
    [syncWithContext, app, onUploadComplete, onUploadClear],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const dotIndex = file.name.lastIndexOf('.');
      const ext = dotIndex >= 0 ? file.name.substring(dotIndex).toLowerCase() : '';

      if (!validExtensions.includes(ext)) {
        setError('Invalid file format. Please upload xlsx, xls, or csv files only.');
        return;
      }

      setIsValidating(true);

      try {
        const parsed = await parseCandidateFile(file);
        const validCandidates = parsed.candidates.filter((c) => c.phoneNormalized);

        if (parsed.candidates.length === 0) {
          setError('No candidate rows found in the file.');
          return;
        }

        if (validCandidates.length === 0) {
          setError(
            'No valid phone numbers found. Ensure phone numbers include country code or 10-digit Indian mobile numbers.',
          );
          return;
        }

        const result: UploadedFile = {
          name: file.name,
          candidatesFound: validCandidates.length,
          validated: true,
          candidates: parsed.candidates,
          columns: parsed.columns,
          invalidPhoneCount: parsed.invalidPhoneCount,
        };

        setUploadedFile(result);

        if (inputRef.current) {
          inputRef.current.value = '';
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse file.');
      } finally {
        setIsValidating(false);
      }
    },
    [setUploadedFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onBrowse = () => inputRef.current?.click();

  if (isValidating) {
    return (
      <Card className="animate-fade-in">
        <div className="flex flex-col items-center py-12 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-maroon" strokeWidth={1.75} />
          <h3 className="mt-6 text-lg font-heading text-gray-900">Reading Excel File...</h3>
          <p className="mt-2 text-sm text-grey-secondary">
            Parsing candidate rows from your spreadsheet
          </p>
        </div>
      </Card>
    );
  }

  if (uploadedFile) {
    const previewRows = uploadedFile.candidates.slice(0, PREVIEW_ROW_LIMIT);
    const columns = uploadedFile.columns;

    return (
      <div className="animate-slide-up space-y-6">
        <Card className="border-2 border-status-success/20 bg-green-50/50">
          <div className="flex flex-col items-center text-center sm:flex-row sm:text-left">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-status-success/10 sm:mb-0 sm:mr-6">
              <CheckCircle2 className="h-8 w-8 text-status-success" strokeWidth={1.75} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-heading text-gray-900">{uploadedFile.name}</h3>
              <p className="mt-1 text-sm text-grey-secondary">
                <span className="font-button text-status-success">
                  {uploadedFile.candidatesFound} Candidates Found
                </span>
                {' · '}
                Validation Complete
                {uploadedFile.invalidPhoneCount > 0 && (
                  <span className="text-status-warning">
                    {' '}
                    · {uploadedFile.invalidPhoneCount} rows with invalid phone skipped
                  </span>
                )}
              </p>
            </div>
            <Button
              variant="secondary"
              className="mt-4 sm:mt-0"
              onClick={() => setUploadedFile(null)}
            >
              <Replace className="h-4 w-4" strokeWidth={1.75} />
              Replace File
            </Button>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-heading text-gray-900">Preview Table</h3>
            <span className="text-xs text-grey-secondary">
              Showing {previewRows.length} of {uploadedFile.candidates.length} rows
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-grey-border">
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="whitespace-nowrap pb-3 pr-4 font-button text-grey-secondary"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.id} className="border-b border-grey-border/60 last:border-0">
                    {columns.map((col) => (
                      <td key={col} className="py-3 pr-4 text-grey-secondary">
                        {row.raw[col] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={`animate-slide-up transition-all duration-200 ${
        isDragging ? 'rounded-card border-2 border-dashed border-maroon bg-maroon/5' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
    >
      <Card>
        <div className="flex flex-col items-center py-12 text-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-maroon/8">
            <div className="relative">
              <FileSpreadsheet className="h-12 w-12 text-maroon/40" strokeWidth={1.25} />
              <Upload className="absolute -bottom-1 -right-1 h-6 w-6 text-maroon" strokeWidth={1.75} />
            </div>
          </div>

          <h3 className="text-xl font-heading text-gray-900">Upload Candidate Excel</h3>
          <p className="mt-2 max-w-md text-sm text-grey-secondary">
            Drag &amp; Drop your candidate file here, or browse to select a file from your computer.
          </p>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-button bg-red-50 px-4 py-2 text-sm text-status-error">
              <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {error}
            </div>
          )}

          <Button className="mt-6" onClick={onBrowse}>
            Browse Files
          </Button>

          <p className="mt-4 text-xs text-grey-secondary">
            Supported formats: <span className="font-button">xlsx</span>,{' '}
            <span className="font-button">xls</span>,{' '}
            <span className="font-button">csv</span>
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      </Card>
    </div>
  );
}
