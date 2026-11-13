import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ApiClientError, type AsyncState } from '../../../lib/index.js';
import { ImportsApiService } from '../services/imports-api.service.js';
import type { HeroImportJob } from '../types/imports.types.js';

export function useCsvImports(onImportCompleted?: () => void) {
  const [jobsState, setJobsState] = useState<AsyncState<readonly HeroImportJob[]>>({
    status: 'loading',
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [expandedErrorJobs, setExpandedErrorJobs] = useState<ReadonlySet<string>>(() => new Set());
  const processingIdsRef = useRef<Set<string>>(new Set());

  const loadJobs = useCallback(
    async (notifyCompleted = false) => {
      try {
        const response = await ImportsApiService.listCsvImports();
        const prevProcessing = processingIdsRef.current;
        const hadCompleted = response.data.some(
          (job) => prevProcessing.has(job.id) && job.status === 'completed',
        );
        const nextProcessingIds = new Set(
          response.data.filter((job) => job.status === 'processing').map((job) => job.id),
        );
        processingIdsRef.current = nextProcessingIds;
        setJobsState({ status: 'success', data: response.data });

        if (notifyCompleted && hadCompleted && nextProcessingIds.size === 0 && onImportCompleted) {
          onImportCompleted();
        }
      } catch (error: unknown) {
        const message =
          error instanceof ApiClientError
            ? error.message
            : 'Não foi possível carregar o andamento das importações.';
        setJobsState({ status: 'error', message });
      }
    },
    [onImportCompleted],
  );

  useEffect(() => {
    void loadJobs(false);
  }, [loadJobs]);

  const hasProcessingJob =
    jobsState.status === 'success' && jobsState.data.some((job) => job.status === 'processing');

  // 650ms polling loop while background jobs are running
  useEffect(() => {
    if (!hasProcessingJob) return undefined;
    const timer = window.setInterval(() => {
      void loadJobs(true);
    }, 650);
    return () => window.clearInterval(timer);
  }, [hasProcessingJob, loadJobs]);

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const started = await ImportsApiService.startCsvImport(file);
      if (started.status === 'processing') {
        processingIdsRef.current.add(started.id);
      }
      setJobsState((prev) => ({
        status: 'success',
        data: prev.status === 'success' ? [started, ...prev.data] : [started],
      }));
    } catch (error: unknown) {
      setUploadError(
        error instanceof ApiClientError ? error.message : 'Falha ao iniciar importação do CSV.',
      );
    } finally {
      setUploading(false);
    }
  };

  const expandJobErrors = (jobId: string): void => {
    setExpandedErrorJobs((prev) => new Set([...prev, jobId]));
  };

  return {
    jobsState,
    loadJobs,
    uploading,
    uploadError,
    expandedErrorJobs,
    expandJobErrors,
    handleFileSelected,
  };
}
