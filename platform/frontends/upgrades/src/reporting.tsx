import { Button } from '@augur/app-kit';
import { useEffect, useState, type ReactNode } from 'react';
import type { UpgradesApi } from './api.js';
import { Facts, When } from './look.js';
import type { Overview, ReportingView } from './model/types.js';

const REASON_WORDS: Record<NonNullable<ReportingView['last']>['reason'], string> = {
  started: 'when the registry started',
  changed: 'after a change',
  heartbeat: 'the regular record',
  daily: 'the daily record',
  export: 'an export',
};

const MODE_WORDS: Record<ReportingView['mode'], string> = {
  send: 'Sent to Backstage',
  file: 'Exported by hand',
  off: 'Off',
};

/** Whether this browser lets the page copy text, so Copy can say why when it can't. */
const canCopy = () => typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function';

/**
 * How this deployment tells Backstage what it runs (ADR 0019): the registry's sentence for why,
 * its name in Backstage, the public key Backstage checks records with, how the last send went,
 * and an export for a server that can't reach Backstage. Off stays visible and says how to turn it on.
 */
export const Reporting = (p: { overview: Overview; api: UpgradesApi; zone: string; now: Date }) => {
  const [view, setView] = useState<ReportingView>();
  const [readError, setReadError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const mode = view?.mode ?? p.overview.reporting?.mode;
  const why = view?.why ?? p.overview.reporting?.why;

  const reported = p.overview.reporting?.mode;
  useEffect(() => {
    if (!reported) return;
    let live = true;
    p.api
      .reporting()
      .then((v) => live && setView(v))
      .catch((e: unknown) => live && setReadError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [p.api, reported]);

  if (!mode || !why) return null;

  const copyReason = !view?.publicKey ? 'The key isn’t here yet.' : !canCopy() ? 'This browser doesn’t let pages copy. Select the key and copy it yourself.' : undefined;
  const exportReason = mode === 'off' ? why : undefined;

  const download = async () => {
    setExporting(true);
    setExportError(undefined);
    try {
      const { name, blob } = await p.api.exportReport();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const last = view?.last;
  return (
    <div className="flex flex-col gap-3" data-reporting={mode}>
      <span className="text-small text-ink-muted">Reporting to Backstage</span>
      <p className="m-0">{why}</p>
      <Facts
        rows={[
          ['Reporting', MODE_WORDS[mode]],
          ...(view?.deployment ? ([['Name in Backstage', view.deployment]] as [string, string][]) : []),
          ...(mode === 'send'
            ? ([
                [
                  'Last sent',
                  last ? (
                    last.ok ? (
                      <span key="l">
                        <When at={last.at} zone={p.zone} now={p.now} />, {REASON_WORDS[last.reason]}
                      </span>
                    ) : (
                      <span key="l" className="text-danger">
                        Not taken <When at={last.at} zone={p.zone} now={p.now} />: {last.problem}
                      </span>
                    )
                  ) : (
                    'Nothing sent since the registry started.'
                  ),
                ],
              ] as [string, ReactNode][])
            : []),
        ]}
      />
      {view?.publicKey && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-small text-ink-muted">Public key, for the annotation augur.dev/report-key on this deployment in Backstage</span>
            <textarea
              readOnly
              rows={2}
              value={view.publicKey}
              className="border border-hairline rounded-inset bg-surface-inset text-ink px-2 py-1 font-mono text-small break-all"
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <span>
            <Button
              kind="secondary"
              size="sm"
              disabled={Boolean(copyReason)}
              reason={copyReason}
              onPress={async () => {
                await navigator.clipboard.writeText(view.publicKey!);
                setCopied(true);
              }}
            >
              {copied ? 'Copied' : 'Copy key'}
            </Button>
          </span>
        </div>
      )}
      <span>
        <Button kind={mode === 'file' ? 'primary' : 'secondary'} size="sm" disabled={Boolean(exportReason)} reason={exportReason} busy={exporting} busyLabel="Exporting" onPress={() => void download()}>
          Export the record
        </Button>
      </span>
      {readError && (
        <p role="alert" className="m-0 text-danger">
          {readError}
        </p>
      )}
      {exportError && (
        <p role="alert" className="m-0 text-danger">
          {exportError}
        </p>
      )}
    </div>
  );
};
