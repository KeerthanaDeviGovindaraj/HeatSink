/**
 * ReportPanel — plain-English, DETERMINISTIC summary of the current site
 * screening with copy and Markdown download (task 8.1, R7.1, R7.2).
 *
 * Presentational: it renders the Markdown produced by the pure
 * {@link buildSummaryMarkdown} (the single source of truth) in a <pre> block —
 * no Markdown-rendering dependency — and offers two actions:
 *   - Copy: writes the summary to the clipboard (navigator.clipboard, with a
 *     document.execCommand fallback) and shows a transient "Copied!" state.
 *   - Download .md: builds a Blob, creates an object URL, clicks a temporary
 *     anchor, then revokes the URL.
 *
 * The panel renders only when a result exists (App gates it); the
 * AssumptionsBanner stays visible above it (R4.6), and the summary itself
 * repeats the screening disclaimer (R7.1).
 */
import { useMemo, useState } from 'react';
import type { SiteResult } from '../model/types';
import type { SpeciesEntry } from '../data/types';
import type { SourceMetas } from '../data/useSnapshots';
import {
  buildSummaryMarkdown,
  summaryFileName,
} from './report';

export interface ReportPanelProps {
  /** The screening result for the placed outfall. */
  result: SiteResult;
  /** Species shown in the UI (displayable set), in display order. */
  species: SpeciesEntry[];
  /** Loaded source meta blocks for the Sources section. */
  metas: SourceMetas;
  /** Human label for the site (preset name, or "Custom site"). */
  siteLabel?: string | undefined;
}

/**
 * Copy text to the clipboard, preferring the async Clipboard API and falling
 * back to a hidden textarea + execCommand for older/insecure contexts. Returns
 * whether the copy appeared to succeed.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/** Trigger a browser download of `text` as a Markdown file named `filename`. */
function downloadMarkdown(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

const buttonStyle: React.CSSProperties = {
  padding: '0.45rem 0.8rem',
  background: '#0b3d5c',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 600,
};

export function ReportPanel({ result, species, metas, siteLabel }: ReportPanelProps) {
  const [copied, setCopied] = useState(false);

  // Deterministic summary + filename (memoized on the inputs).
  const markdown = useMemo(
    () => buildSummaryMarkdown({ result, species, metas, siteLabel }),
    [result, species, metas, siteLabel],
  );
  const filename = useMemo(() => summaryFileName(result), [result]);

  const handleCopy = async () => {
    const ok = await copyText(markdown);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section
      data-testid="report-panel"
      aria-label="Summary"
      style={{
        border: '1px solid #cfd8dc',
        borderRadius: 8,
        padding: '0.9rem 1rem',
        background: '#fff',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          marginBottom: '0.6rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1rem' }}>Summary</h2>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button type="button" onClick={handleCopy} style={buttonStyle}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={() => downloadMarkdown(markdown, filename)}
            style={buttonStyle}
          >
            Download .md
          </button>
        </div>
      </div>

      <pre
        style={{
          margin: 0,
          padding: '0.7rem 0.8rem',
          background: '#f5f7f8',
          borderRadius: 6,
          fontSize: '0.78rem',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '22rem',
          overflow: 'auto',
        }}
      >
        {markdown}
      </pre>
    </section>
  );
}
