import { Mic, MicOff } from 'lucide-react';

interface MicButtonProps {
  listening: boolean;
  onClick: () => void;
}

export default function MicButton({ listening, onClick }: MicButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={listening ? 'Stop voice input' : 'Speak your prompt'}
      aria-pressed={listening}
      className={`p-2 rounded-lg min-w-[40px] min-h-[40px] flex items-center justify-center transition-colors duration-200 ${
        listening
          ? 'text-red-400 bg-red-400/10 animate-pulse'
          : 'text-muted hover:text-content hover:bg-panel-hover'
      }`}
    >
      {listening ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
}