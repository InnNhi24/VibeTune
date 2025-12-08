"use client";
import { useRef, useState } from "react";

type ProsodySummary = {
  dur_s: number;
  f0_mean: number | null;
  f0_stdev: number | null;
  energy_mean: number | null;
  pause_count: number;
  avg_pause_ms: number | null;
  speech_rate_spm: number | null;
  monotony_0to1: number | null;
  tips: string[];
  f0_contour?: Array<{ t: number; f0: number | null }>;
};

interface UseProsodyOpts {
  bufferSize?: number;
  storeContour?: boolean;
  minPauseMs?: number;
  dynamicPausePercentile?: number;
}

export function useProsodyAnalyzer(opts: UseProsodyOpts = {}) {
  const {
    bufferSize = 2048,
    storeContour = true,
    minPauseMs = 200,
    dynamicPausePercentile = 0.2,
  } = opts;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTsRef = useRef<number | null>(null);

  const samplesRef = useRef<Float32Array[]>([]);
  const rmsRef = useRef<number[]>([]);
  const contourRef = useRef<Array<{ t: number; f0: number | null }>>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [summary, setSummary] = useState<ProsodySummary | null>(null);

  // basic autocorrelation pitch detector
  function detectPitch(buf: Float32Array, sampleRate: number) {
    const n = buf.length;
    let bestOffset = -1;
    let bestCorrelation = 0;
    const correlations = new Float32Array(Math.floor(n / 2));
    for (let offset = 0; offset < correlations.length; offset++) {
      let sum = 0;
      for (let i = 0; i < correlations.length; i++) {
        sum += Math.abs(buf[i] - buf[i + offset]);
      }
      const corr = 1 - sum / correlations.length;
      correlations[offset] = corr;
      if (corr > bestCorrelation) {
        bestCorrelation = corr;
        bestOffset = offset;
      }
    }
    if (bestCorrelation > 0.35 && bestOffset > 0) {
      const frequency = sampleRate / bestOffset;
      return { frequency, clarity: bestCorrelation };
    }
    return { frequency: null, clarity: bestCorrelation };
  }

  function computeRMS(buf: Float32Array) {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  async function start() {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ac;
      streamRef.current = stream;
      srcRef.current = ac.createMediaStreamSource(stream);

      procRef.current = ac.createScriptProcessor(bufferSize, 1, 1);

      srcRef.current.connect(procRef.current);
      procRef.current.connect(ac.destination);

      samplesRef.current = [];
      rmsRef.current = [];
      contourRef.current = [];
      startTsRef.current = performance.now();

      procRef.current.onaudioprocess = (ev: AudioProcessingEvent) => {
        const chan = ev.inputBuffer.getChannelData(0);
        // copy to new buffer
        const copy = new Float32Array(chan.length);
        copy.set(chan);
        samplesRef.current.push(copy);

        const rms = computeRMS(copy);
        rmsRef.current.push(rms);

        const pitch = detectPitch(copy, ac.sampleRate);
        const t = (performance.now() - (startTsRef.current || 0)) / 1000;
        if (storeContour) contourRef.current.push({ t, f0: pitch.frequency });
      };

      setIsRecording(true);
      setSummary(null);
    } catch (e) {
      console.error('Prosody start failed', e);
      throw e;
    }
  }

  function stopAndCompute(): ProsodySummary {
    const ac = audioCtxRef.current;
    const stream = streamRef.current;

    // stop audio processing
    if (procRef.current) {
      try { 
        procRef.current.disconnect(); 
      } catch {
        // Already disconnected
      }
      procRef.current.onaudioprocess = null as any;
      procRef.current = null;
    }
    if (srcRef.current) {
      try { 
        srcRef.current.disconnect(); 
      } catch {
        // Already disconnected
      }
      srcRef.current = null;
    }
    if (stream) {
      try { 
        stream.getTracks().forEach(t => t.stop()); 
      } catch {
        // Tracks already stopped
      }
      streamRef.current = null;
    }
    if (ac) {
      try { 
        ac.close(); 
      } catch {
        // Audio context already closed
      }
      audioCtxRef.current = null;
    }

    const frames = samplesRef.current;
    const rmsFrames = rmsRef.current;
    const contour = contourRef.current;
    const dur_s = frames.reduce((acc, f) => acc + f.length, 0) / (frames.length ? 48000 : 48000) || 0;
    // safer duration: use last contour time
    const durFromContour = contour.length ? contour[contour.length - 1].t : 0;
    const duration = Math.max(dur_s, durFromContour);

    // f0 stats from contour (ignore nulls)
    const f0s = contour.map(c => c.f0).filter((v): v is number => v != null && isFinite(v));
    const f0_mean = f0s.length ? f0s.reduce((a, b) => a + b, 0) / f0s.length : null;
    const f0_stdev = f0s.length ? Math.sqrt(f0s.reduce((a, b) => a + Math.pow(b - (f0_mean || 0), 2), 0) / f0s.length) : null;

    const energy_mean = rmsFrames.length ? rmsFrames.reduce((a, b) => a + b, 0) / rmsFrames.length : null;

    // detect pauses: frames with rms below percentile threshold
    const sortedRms = [...rmsFrames].sort((a, b) => a - b);
    const idx = Math.max(0, Math.floor(sortedRms.length * dynamicPausePercentile));
    const dynamicThresh = sortedRms[idx] || 0;
    // simplified pause detection by scanning rms frames for low segments
    const pauseDurations: number[] = [];
    let inPause = false;
    let pauseStart = 0;
    const msPerFrame = duration && rmsFrames.length ? (duration / rmsFrames.length) * 1000 : 0;
    for (let i = 0; i < rmsFrames.length; i++) {
      const isLow = rmsFrames[i] <= Math.max(dynamicThresh, 0.0005);
      if (isLow && !inPause) {
        inPause = true;
        pauseStart = i;
      } else if (!isLow && inPause) {
        inPause = false;
        const ms = (i - pauseStart) * msPerFrame;
        if (ms >= minPauseMs) pauseDurations.push(ms);
      }
    }
    if (inPause) {
      const ms = (rmsFrames.length - pauseStart) * msPerFrame;
      if (ms >= minPauseMs) pauseDurations.push(ms);
    }

    const pause_count = pauseDurations.length;
    const avg_pause_ms = pauseDurations.length ? pauseDurations.reduce((a, b) => a + b, 0) / pauseDurations.length : null;

    // estimate syllable rate: count energy peaks in envelope
    let peaks = 0;
    let lastPeakIndex = -Infinity;
    const minPeakDistanceFrames = Math.max(1, Math.floor(0.08 * (rmsFrames.length ? (duration ? (rmsFrames.length / duration) : 100) : 100)));
    const peakThresh = energy_mean ? energy_mean * 1.2 : (sortedRms[Math.floor(sortedRms.length * 0.75)] || 0.01);
    for (let i = 1; i < rmsFrames.length - 1; i++) {
      if (rmsFrames[i] > rmsFrames[i - 1] && rmsFrames[i] > rmsFrames[i + 1] && rmsFrames[i] > peakThresh && i - lastPeakIndex > minPeakDistanceFrames) {
        peaks++;
        lastPeakIndex = i;
      }
    }
    const speech_rate_spm = duration > 0 ? Math.round((peaks / duration) * 60) : null;

    // monotony mapping
    const monotony_0to1 = f0_stdev != null ? Math.min(1, Math.max(0, 1 - (f0_stdev / 60))) : null;

    // tips generation (3-4 short heuristics)
    const tips: string[] = [];
    if (duration < 8) tips.push('Try a longer sample (≥10s) for more accurate feedback.');
    if (energy_mean != null && energy_mean < 0.01) tips.push('Speak closer to the mic or increase your volume.');
    if (f0_stdev != null && f0_stdev < 20) tips.push('Add pitch variation — emphasize key words and use rising/falling intonation.');
    if (avg_pause_ms != null && avg_pause_ms > 500) tips.push('Try shortening long pauses to keep flow (aim ~180–400 ms).');
    if (speech_rate_spm != null && (speech_rate_spm < 120)) tips.push('Increase speaking rate slightly to sound more natural.');
    if (speech_rate_spm != null && (speech_rate_spm > 260)) tips.push('Slow down a bit to improve clarity.');
    while (tips.length < 3) {
      tips.push('Practice emphasizing keywords and vary pitch to reduce monotony.');
    }

    const result: ProsodySummary = {
      dur_s: Math.round(duration * 10) / 10,
      f0_mean: f0_mean ? Math.round(f0_mean * 10) / 10 : null,
      f0_stdev: f0_stdev ? Math.round(f0_stdev * 10) / 10 : null,
      energy_mean: energy_mean != null ? Math.round(energy_mean * 100000) / 100000 : null,
      pause_count,
      avg_pause_ms: avg_pause_ms ? Math.round(avg_pause_ms) : null,
      speech_rate_spm: speech_rate_spm || null,
      monotony_0to1: monotony_0to1 != null ? Math.round(monotony_0to1 * 100) / 100 : null,
      tips: tips.slice(0, 4),
      f0_contour: storeContour ? contour.map(c => ({ t: Math.round(c.t * 100) / 100, f0: c.f0 ? Math.round(c.f0 * 10) / 10 : null })) : undefined,
    };

    samplesRef.current = [];
    rmsRef.current = [];
    contourRef.current = [];
    startTsRef.current = null;

    setSummary(result);
    setIsRecording(false);
    return result;
  }

  async function stop() {
    if (!isRecording) return null;
    try {
      const res = stopAndCompute();
      return res;
    } catch (e) {
      console.error('Prosody stop failed', e);
      setIsRecording(false);
      return null;
    }
  }

  return {
    start,
    stop,
    isRecording,
    summary,
  } as const;
}

export type { ProsodySummary };
