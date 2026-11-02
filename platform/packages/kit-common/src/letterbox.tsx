import type { ReactNode } from 'react';
import { Dialog as AriaDialog, Modal, ModalOverlay } from 'react-aria-components';
import { Heading } from './heading.js';

export interface LetterboxProps {
  open: boolean;
  /** Close it, when it can be closed. Leave out for something that must be answered first. */
  onClose?: () => void;
  eyebrow?: string;
  heading: string;
  summary?: string;
  /** What the person can do about it: one primary, and Cancel or Later. */
  actions?: ReactNode;
  children?: ReactNode;
}

/**
 * Urgent is letterboxed (PDR-009): something urgent and important is shown in
 * a wide 2.39:1 frame (the `letterbox-ratio` token) across the middle of the
 * screen, and everything above and below it steps back behind the scrim.
 * Nothing is hidden for good; it all comes back when this is dealt with. Focus
 * stays inside while it's open. Use it rarely: for what can't wait.
 */
export function Letterbox({ open, onClose, eyebrow, heading, summary, actions, children }: LetterboxProps) {
  return (
    <ModalOverlay isOpen={open} onOpenChange={(next) => !next && onClose?.()} isDismissable={false} isKeyboardDismissDisabled={!onClose} className="augur-letterbox">
      <Modal className="augur-letterbox-frame">
        <AriaDialog aria-label={heading} role="alertdialog" className="augur-letterbox-body outline-none">
          <Heading eyebrow={eyebrow} heading={heading} summary={summary} size="l" />
          {children ? <div className="augur-letterbox-text">{children}</div> : null}
          {actions ? <div className="augur-letterbox-actions">{actions}</div> : null}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
