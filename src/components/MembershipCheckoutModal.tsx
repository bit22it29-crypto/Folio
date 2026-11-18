import { useState } from 'react';
import { Check, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { Publication } from '../types/folio';

interface MembershipCheckoutModalProps {
  publication: Publication | null;
  onClose: () => void;
  onConfirmSupport: (
    publication: Publication,
    plan: 'monthly' | 'annual',
    receipt: { receiptId: string; amountUsd: number }
  ) => Promise<void>;
}

export function MembershipCheckoutModal({
  publication,
  onClose,
  onConfirmSupport,
}: MembershipCheckoutModalProps) {
  const [plan, setPlan] = useState<'monthly' | 'annual'>('annual');
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<{
    receiptId: string;
    amountUsd: number;
    plan: 'monthly' | 'annual';
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!publication) return null;

  const amountUsd = plan === 'annual' ? 70 : 7;

  const handleComplete = async () => {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/membership/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicationId: publication.id,
          publicationName: publication.name,
          plan,
        }),
      });
      if (!res.ok) {
        throw new Error('Checkout endpoint failed');
      }
      const data = (await res.json()) as {
        receiptId: string;
        amountUsd: number;
        plan: 'monthly' | 'annual';
      };
      await onConfirmSupport(publication, data.plan, {
        receiptId: data.receiptId,
        amountUsd: data.amountUsd,
      });
      setReceipt(data);
    } catch {
      setError('Could not complete supporting membership checkout. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Support ${publication.name}`}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !processing) onClose();
      }}
    >
      <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-accent-soft)] mb-1">
              Supporting Membership
            </p>
            <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
              {publication.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {receipt ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[var(--bg-active-soft)] border border-[var(--border-strong)]">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-accent)] mb-1">
                <Check className="w-4 h-4" />
                <span>Supporting Tier Activated</span>
              </div>
              <p className="text-xs text-[var(--text-body)] leading-relaxed">
                You are now a Supporting Member of {publication.name} (${receipt.amountUsd}{' '}
                {receipt.plan === 'annual' ? 'annual' : 'monthly'} plan).
              </p>
              <p className="font-mono text-[11px] text-[var(--text-muted)] mt-2">
                Receipt: {receipt.receiptId}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-sm font-medium bg-[#6D28D9] text-white rounded-lg hover:bg-[#7C3AED] transition-colors cursor-pointer"
            >
              Continue Reading
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={() => setPlan('monthly')}
                className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  plan === 'monthly'
                    ? 'border-[#8B5CF6] bg-[var(--bg-active-soft)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:border-[var(--border-strong)]'
                }`}
              >
                <p className="text-xs font-medium text-[var(--text-muted)]">Monthly</p>
                <p className="font-display text-2xl font-semibold text-[var(--text-primary)] tabular-nums mt-0.5">
                  $7<span className="text-xs font-sans font-normal text-[var(--text-muted)]">/mo</span>
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPlan('annual')}
                className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  plan === 'annual'
                    ? 'border-[#8B5CF6] bg-[var(--bg-active-soft)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-medium text-[var(--text-muted)]">Annual</p>
                  <span className="text-[10px] font-semibold text-[var(--text-accent)]">
                    Save 17%
                  </span>
                </div>
                <p className="font-display text-2xl font-semibold text-[var(--text-primary)] tabular-nums mt-0.5">
                  $70<span className="text-xs font-sans font-normal text-[var(--text-muted)]">/yr</span>
                </p>
              </button>
            </div>

            <ul className="space-y-2.5 text-xs text-[var(--text-body)] mb-6">
              <li className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[var(--text-accent-soft)] shrink-0" />
                <span>Full access to all subscriber-only dispatches & archives</span>
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[var(--text-accent-soft)] shrink-0" />
                <span>Supporter crest alongside your Salon comments & replies</span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--text-accent-soft)] shrink-0" />
                <span>Directly funds independent writing by {publication.ownerName}</span>
              </li>
            </ul>

            {error && (
              <p className="text-xs text-[var(--text-danger)] mb-3">{error}</p>
            )}

            <button
              type="button"
              disabled={processing}
              onClick={handleComplete}
              className="w-full py-2.5 text-sm font-medium bg-[#6D28D9] text-white rounded-lg hover:bg-[#7C3AED] disabled:opacity-50 transition-colors cursor-pointer tabular-nums"
            >
              {processing
                ? 'Activating Membership...'
                : `Become a Supporting Member ($${amountUsd})`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
