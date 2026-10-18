import type { DetailedHTMLProps, HTMLAttributes, Ref } from 'react';
import type { UiButton, UiHeading, UiShell } from '@platform/ui-kit';

type Element<T, P = object> = DetailedHTMLProps<HTMLAttributes<T>, T> & P & { ref?: Ref<T> };

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'ui-shell': Element<UiShell, { product?: string }>;
      'ui-heading': Element<UiHeading, { heading?: string; summary?: string; eyebrow?: string; size?: 's' | 'm' | 'l' }>;
      'ui-button': Element<UiButton, { kind?: string }>;
    }
  }
}
