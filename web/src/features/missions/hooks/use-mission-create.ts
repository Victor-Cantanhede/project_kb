import { useState, type FormEvent } from 'react';
import { ApiClientError } from '../../../lib/index.js';
import { MissionsApiService } from '../services/missions-api.service.js';
import type { Mission } from '../types/missions.types.js';

export function defaultDateTimeLocal(hoursOffset: number): string {
  const date = new Date(Date.now() + hoursOffset * 3600_000);
  date.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function useMissionCreate(onCreated: (mission: Mission) => void) {
  const [title, setTitle] = useState('');
  const [startsAtLocal, setStartsAtLocal] = useState(() => defaultDateTimeLocal(1));
  const [endsAtLocal, setEndsAtLocal] = useState(() => defaultDateTimeLocal(3));
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMessage(null);
    setFieldErrors({});

    const startDate = new Date(startsAtLocal);
    const endDate = new Date(endsAtLocal);
    const dateErrors: Record<string, string> = {};

    if (Number.isNaN(startDate.getTime())) {
      dateErrors.starts_at = 'Informe uma data e hora de início válidas.';
    }
    if (Number.isNaN(endDate.getTime())) {
      dateErrors.ends_at = 'Informe uma data e hora de término válidas.';
    }

    if (Object.keys(dateErrors).length > 0) {
      setSaving(false);
      setErrorMessage('Informe datas e horários válidos.');
      setFieldErrors(dateErrors);
      return;
    }

    try {
      const created = await MissionsApiService.createMission({
        title,
        starts_at: startDate.toISOString(),
        ends_at: endDate.toISOString(),
      });
      onCreated(created);
    } catch (error: unknown) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
        const byField: Record<string, string> = {};
        for (const f of error.fields) {
          byField[f.field] = f.message;
        }
        setFieldErrors(byField);
      } else {
        setErrorMessage('Não foi possível criar a missão.');
      }
    } finally {
      setSaving(false);
    }
  };

  return {
    title,
    setTitle,
    startsAtLocal,
    setStartsAtLocal,
    endsAtLocal,
    setEndsAtLocal,
    saving,
    errorMessage,
    fieldErrors,
    handleSubmit,
  };
}
