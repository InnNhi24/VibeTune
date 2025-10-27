import { useRef, useState, useCallback } from 'react';

type ASRController = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  transcript: string;
  isRunning: boolean;
};

export function useLiveASR(): ASRController {
  const mediaRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [transcript, setTranscript] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const start = useCallback(async () => {
    // Try Web Speech API first (quick fallback demo) — Chrome prefixed variant
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SpeechRecognition) {
      try {
        const r = new SpeechRecognition();
        r.continuous = true;
        r.interimResults = true;
        r.lang = 'en-US';
        r.onresult = (ev: any) => {
          let text = '';
          for (let i = ev.resultIndex; i < ev.results.length; ++i) {
            text += ev.results[i][0].transcript;
          }
          setTranscript(prev => (prev ? prev + ' ' + text : text));
        };
        r.onerror = (e: any) => {
          console.warn('SpeechRecognition error', e);
        };
        r.start();
        // Note: we do not expose the recognition instance; this is a quick fallback only
        setIsRunning(true);
        return;
      } catch (err) {
        // fallthrough to media recorder + websocket
        console.warn('SpeechRecognition failed, falling back to media recorder', err);
      }
    }

    // MediaRecorder + WebSocket path (for Deepgram proxy function)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const options: any = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32000 };
    const media = new MediaRecorder(stream, options);
    mediaRef.current = media;

    const wsUrl = (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || (window as any).__SUPABASE_FUNCTIONS_URL__) + '/realtime-asr';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      media.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === 1) {
          try { ws.send(e.data); } catch (err) { console.warn('ws send error', err); }
        }
      };

      media.start(200);
      setIsRunning(true);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const text = msg.channel?.alternatives?.[0]?.transcript || msg.transcript || '';
        if (text) setTranscript(prev => (prev ? prev + ' ' + text : text));
      } catch (err) {
        // some servers might send plain text
        const s = String(ev.data || '');
        if (s) setTranscript(prev => (prev ? prev + ' ' + s : s));
      }
    };

    ws.onerror = (e) => console.warn('WS error', e);
    ws.onclose = () => {
      try { media.stop(); } catch (e) {}
      stream.getTracks().forEach(t => t.stop());
      setIsRunning(false);
    };

  }, []);

  const stop = useCallback(async () => {
    try {
      if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
      if (wsRef.current && wsRef.current.readyState === 1) wsRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    } catch (err) {
      console.warn('stop error', err);
    }
    setIsRunning(false);
  }, []);

  return { start, stop, transcript, isRunning };
}

export default useLiveASR;
