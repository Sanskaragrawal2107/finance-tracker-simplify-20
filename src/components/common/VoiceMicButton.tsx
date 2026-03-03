import React from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceInput } from '@/hooks/use-voice-input';

interface VoiceMicButtonProps {
  /** Called with the final recognized text */
  onTranscript: (text: string) => void;
  /** Extra CSS classes for the button */
  className?: string;
  /** BCP-47 language tag, default "en-IN" */
  lang?: string;
  /** Whether to append to existing text (true) or replace it (false) */
  append?: boolean;
  /** Current field value – used when append=true */
  currentValue?: string;
}

/**
 * A small mic button that activates voice-to-text via the Web Speech API.
 * Drop it inside any input wrapper to give that field voice input.
 *
 * Usage:
 * ```tsx
 * <div className="relative">
 *   <Input value={value} onChange={...} className="pr-10" />
 *   <VoiceMicButton
 *     onTranscript={(t) => setValue(t)}
 *     className="absolute right-2 top-1/2 -translate-y-1/2"
 *   />
 * </div>
 * ```
 */
const VoiceMicButton: React.FC<VoiceMicButtonProps> = ({
  onTranscript,
  className,
  lang = 'en-IN',
  append = false,
  currentValue = '',
}) => {
  const { isListening, isSupported, startListening } = useVoiceInput(
    (text) => {
      const result = append && currentValue ? `${currentValue} ${text}` : text;
      onTranscript(result);
    },
    lang
  );

  if (!isSupported) return null;

  return (
    <button
      type="button"
      aria-label={isListening ? 'Stop listening' : 'Start voice input'}
      onClick={startListening}
      className={cn(
        'flex items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'h-7 w-7',
        isListening
          ? 'text-red-500 bg-red-50 animate-pulse hover:bg-red-100'
          : 'text-muted-foreground hover:text-primary hover:bg-primary/10',
        className
      )}
    >
      {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
    </button>
  );
};

export default VoiceMicButton;
