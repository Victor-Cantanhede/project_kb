import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { api } from '../api.js';
import { ApiClientError, assertUnreachable, type AsyncState, type HeroImportJob } from '../types.js';

interface CsvImportModalProps {
  readonly onClose: () => void;
  readonly onImportCompleted: () => void;
}

const numberFmt = new Intl.NumberFormat('pt-BR');
const INITIAL_ERROR_PREVIEW_COUNT = 100;

export function CsvImportModal({ onClose, onImportCompleted }: CsvImportModalProps) {
  const [jobsState, setJobsState] = useState<AsyncState<readonly HeroImportJob[]>>({
    status: 'loading',
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [expandedErrorJobs, setExpandedErrorJobs] = useState<ReadonlySet<string>>(() => new Set());
  const processingIdsRef = useRef<Set<string>>(new Set());

  const loadJobs = useCallback(async (notifyCompleted = false) => {
    try {
      const response = await api.listCsvImports();
      const prevProcessing = processingIdsRef.current;
      const hadCompleted = response.data.some(
        (job) => prevProcessing.has(job.id) && job.status === 'completed',
      );
      const nextProcessingIds = new Set(
        response.data.filter((job) => job.status === 'processing').map((job) => job.id),
      );
      processingIdsRef.current = nextProcessingIds;
      setJobsState({ status: 'success', data: response.data });
      if (notifyCompleted && hadCompleted && nextProcessingIds.size === 0) {
        onImportCompleted();
      }
    } catch (error: unknown) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : 'Não foi possível carregar o andamento das importações.';
      setJobsState({ status: 'error', message });
    }
  }, [onImportCompleted]);

  useEffect(() => {
    void loadJobs(false);
  }, [loadJobs]);

  const hasProcessingJob =
    jobsState.status === 'success' && jobsState.data.some((job) => job.status === 'processing');

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
      const started = await api.startCsvImport(file);
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

  const renderJobs = () => {
    switch (jobsState.status) {
      case 'loading':
        return <p className="muted-state">Carregando importações...</p>;
      case 'error':
        return (
          <div className="inline-error-state">
            <span>{jobsState.message}</span>
            <button type="button" className="btn-outline btn-sm" onClick={() => void loadJobs(false)}>
              Tentar novamente
            </button>
          </div>
        );
      case 'success': {
        if (jobsState.data.length === 0) {
          return (
            <p className="muted-state">
              Nenhuma importação realizada ainda. Envie um arquivo CSV acima para começar.
            </p>
          );
        }
        return (
          <div className="import-jobs-list">
            {jobsState.data.map((job) => {
              const pct =
                job.total_rows > 0
                  ? Math.min(100, Math.round((job.processed_rows / job.total_rows) * 100))
                  : 0;
              return (
                <div key={job.id} className="import-job-card">
                  <div className="import-job-top">
                    <strong>{job.filename}</strong>
                    <span className={`status-badge status-import-${job.status}`}>
                      {job.status === 'processing'
                        ? 'Em processamento'
                        : job.status === 'completed'
                          ? 'Concluída'
                          : 'Falhou'}
                    </span>
                  </div>

                  <div className="import-progress-row">
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="progress-counter">
                      {numberFmt.format(job.processed_rows)} de {numberFmt.format(job.total_rows)}
                    </span>
                  </div>

                  <p className="import-summary-text">
                    {numberFmt.format(job.imported_count)} importados,{' '}
                    {numberFmt.format(job.duplicate_count)} já existiam,{' '}
                    {numberFmt.format(job.error_count)} com erro.
                  </p>

                  {job.failure_reason && (
                    <p className="field-error-text">Motivo da falha: {job.failure_reason}</p>
                  )}

                  {job.errors.length > 0 && (() => {
                    const isExpanded = expandedErrorJobs.has(job.id);
                    const visibleErrors = isExpanded
                      ? job.errors
                      : job.errors.slice(0, INITIAL_ERROR_PREVIEW_COUNT);
                    return (
                      <details className="import-errors-details">
                        <summary>
                          Ver {numberFmt.format(job.errors.length)} linha(s) recusada(s)
                        </summary>
                        <ul className="import-errors-list">
                          {visibleErrors.map((err) => (
                            <li key={`${job.id}-line-${err.line}`}>
                              <strong>Linha {err.line}:</strong> {err.message}
                            </li>
                          ))}
                        </ul>
                        {job.errors.length > INITIAL_ERROR_PREVIEW_COUNT && !isExpanded && (
                          <button
                            type="button"
                            className="btn-outline btn-sm import-errors-expand"
                            onClick={() =>
                              setExpandedErrorJobs((prev) => new Set([...prev, job.id]))
                            }
                          >
                            Mostrar todas as {numberFmt.format(job.errors.length)} linhas com erro
                          </button>
                        )}
                      </details>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        );
      }
      default:
        return assertUnreachable(jobsState);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="csv-modal-title">
      <div className="modal-card modal-card-scrollable">
        <div className="modal-header">
          <h2 id="csv-modal-title">Importar CSV de Heróis</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar modal">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="csv-upload-box">
            <p className="csv-instructions">
              Envie um arquivo <code>.csv</code> com até <strong>20.000 heróis</strong>. A primeira
              linha deve ser:
            </p>
            <code className="csv-header-code">
              name,nickname,date_of_birth,universe,main_power,avatar_url
            </code>
            <p className="csv-subnote">
              Você pode iniciar outra importação enquanto uma ainda está rodando em segundo plano.
            </p>
            <label className="btn-primary-pill csv-upload-btn">
              {uploading ? 'Enviando CSV...' : 'Selecionar arquivo CSV'}
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                disabled={uploading}
                onChange={(e) => void handleFileSelected(e)}
              />
            </label>
          </div>

          {uploadError && (
            <div className="alert-banner alert-error" role="alert">
              {uploadError}
            </div>
          )}

          <hr className="section-divider" />
          <h3 className="section-subtitle">Andamento e histórico de importações</h3>
          {renderJobs()}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-outline" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

