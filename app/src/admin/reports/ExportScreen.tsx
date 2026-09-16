import { Download } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { ApiRequestError } from '../../api/errors.ts';
import { ds } from '../../styles/tokens.ts';
import { Button } from '../../ui/Button.tsx';
import { adminApi } from '../api.ts';
import { PageHeader, Panel } from '../components.tsx';
import { todayInPakistan } from '../format.ts';

/** Downloads every session in a date range as CSV for Excel or SPSS. */
export function ExportScreen() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fromId = useId();
  const toId = useId();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const blob = await adminApi.exportCsv(from || undefined, to || undefined);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `omp-sessions-${todayInPakistan()}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError
          ? caught.message
          : 'The download failed. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Export"
        subtitle="One row per session, dates in Pakistan time, UTF-8 for Excel and SPSS"
      />
      <Panel style={{ maxWidth: 560 }}>
        <form
          onSubmit={onSubmit}
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <label
              htmlFor={fromId}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: ds.txB,
                display: 'block',
                marginBottom: 6,
              }}
            >
              From
            </label>
            <input
              id={fromId}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={ds.input}
            />
          </div>
          <div>
            <label
              htmlFor={toId}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: ds.txB,
                display: 'block',
                marginBottom: 6,
              }}
            >
              To
            </label>
            <input
              id={toId}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={ds.input}
            />
          </div>
          <Button type="submit" icon={<Download size={16} />} disabled={busy}>
            {busy ? 'Preparing…' : 'Download CSV'}
          </Button>
        </form>
        <p style={{ fontSize: 13, color: ds.txMuted, margin: '12px 0 0' }}>
          Leave both dates empty to download every session. Each download is
          recorded.
        </p>
        {error && (
          <p role="alert" style={{ color: ds.redText, fontSize: 14 }}>
            {error}
          </p>
        )}
      </Panel>
    </>
  );
}
