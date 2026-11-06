import type { Metadata } from 'next';
import { GuestCardForm } from '@/components/GuestCardForm';
import { PageShell } from '@/components/PageShell';

export const metadata: Metadata = { title: 'Host a party', robots: { index: false } };

export default function HostPage() {
  return (
    <PageShell back={{ href: '/#enter', label: 'Back' }}>
      <div className="mb-8 text-center">
        <p className="type-eyebrow text-marigold-400">Host a party</p>
        <h1 className="type-masthead-lg mt-3">Open your house</h1>
        <p lang="hi" className="type-story-lg mt-2 text-marigold-200">
          घर के दरवाज़े खोलिए
        </p>
        <p className="type-story mt-4 text-[color:var(--ink-on-night-muted)]">
          You will get an invitation link and QR code to share. Only people with the invitation can
          come in.
        </p>
      </div>
      <GuestCardForm mode="host" />
    </PageShell>
  );
}
