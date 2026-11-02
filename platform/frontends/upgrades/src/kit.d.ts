// The one Lit kit element still in use (the status mark), until Common has its own (ADR 0015).
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type El<P> = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & P;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'ui-status': El<{ status: 'needs' | 'running' | 'queued' | 'paused' | 'done' | 'failed' | 'warning'; label?: string; 'mark-only'?: boolean }>;
    }
  }
}
