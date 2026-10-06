import { useCallback, useEffect, useRef, useState } from 'react';

const SR =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    : null;

export function useSpeechRecognition(onTranscript: (text: string) => void) {
  const recRef = useRef<any>(null);
  const cbRef = useRef(onTranscript);
  cbRef.current = onTranscript;

  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(() => {
    if (!SR || recRef.current) return;

    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (e: any) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript;
      }
      if (text.trim()) cbRef.current(text.trim());
    };

    rec.onerror = (e: any) => {
      setError(
        e.error === 'not-allowed'
          ? 'Microphone permission denied.'
          : `Voice input error: ${e.error}`
      );
    };

    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };

    recRef.current = rec;
    setError(null);
    rec.start();
    setListening(true);
  }, []);

  const stop = useCallback(() => recRef.current?.stop(), []);

  const toggle = useCallback(
    () => (listening ? stop() : start()),
    [listening, start, stop]
  );

  useEffect(() => () => recRef.current?.abort(), []);

  return { supported: !!SR, listening, error, toggle };
}