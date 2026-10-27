import type { DetailedHTMLProps, HTMLAttributes, Ref } from 'react';
import type { UiButton, UiCentreMenu, UiDialog, UiHeading, UiShell } from '@augur/ui-kit';

type Element<T, P = object> = DetailedHTMLProps<HTMLAttributes<T>, T> & P & { ref?: Ref<T> };

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'ui-shell': Element<UiShell, { product?: string }>;
      'ui-centre-menu': Element<UiCentreMenu, { variant?: 'orbit' | 'title'; label?: string }>;
      'ui-heading': Element<UiHeading, { heading?: string; summary?: string; eyebrow?: string; size?: 's' | 'm' | 'l' }>;
      'ui-button': Element<UiButton, { kind?: string; size?: 'sm' | 'md' }>;
      'ui-dialog': Element<UiDialog, { heading?: string; summary?: string; size?: 'decision' | 'glance' | 'read'; cancelLabel?: string }>;
    }
  }
}
