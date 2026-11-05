import type { Metadata } from 'next';
import { BlindReview } from '@/components/blind-review';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Private voice comparison — WithYou',
  description: 'A private, provider-blinded voice comparison.',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <BlindReview token={token} />;
}
