import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

// A small (?) icon that reveals help text on hover/focus.
export default function InfoHint({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="text-textFaint hover:text-accent transition-colors"
        aria-label="Help"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {show && (
        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-60 z-20
          bg-elevated border border-border rounded-lg p-2.5 text-xs text-textMuted
          leading-relaxed shadow-xl font-normal normal-case">
          {text}
        </span>
      )}
    </span>
  );
}
