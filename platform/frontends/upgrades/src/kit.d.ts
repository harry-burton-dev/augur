// The Lit kit's elements as React sees them, until Quill has its own parts (ADR 0015).
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type El<P> = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & P;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'ui-status': El<{ status: 'needs' | 'running' | 'queued' | 'paused' | 'done' | 'failed' | 'warning'; label?: string; 'mark-only'?: boolean }>;
      'ui-button': El<{ kind?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger'; size?: 'small'; disabled?: boolean; reason?: string; busy?: boolean; 'busy-label'?: string }>;
      'ui-icon': El<{ name: string }>;
    }
  }
}
