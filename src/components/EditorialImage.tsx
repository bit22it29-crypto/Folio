import { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface EditorialImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function EditorialImage({
  src,
  alt,
  className = '',
  fallbackTitle,
}: EditorialImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-hairline)] p-6 text-center ${className}`}
      >
        <BookOpen className="w-6 h-6 mb-2 stroke-[1.5] text-[var(--text-accent-soft)]" aria-hidden="true" />
        {fallbackTitle && (
          <span className="font-display text-sm text-[var(--text-secondary)] line-clamp-2 max-w-[22ch]">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
