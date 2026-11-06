'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import styles from './Dialog.module.css';
import { Frame } from './Frame';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  /** Usually a confirm and a cancel Button. */
  actions: ReactNode;
}

/** Radix handles focus trapping, Escape, and labelling; we supply the paper. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  actions,
}: ConfirmDialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content className={styles.content}>
          <Frame variant="paper">
            <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
            <RadixDialog.Description className={styles.description}>
              {description}
            </RadixDialog.Description>
            <div className={styles.actions}>{actions}</div>
          </Frame>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export const DialogClose = RadixDialog.Close;
