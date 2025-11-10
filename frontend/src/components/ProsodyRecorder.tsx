"use client";
import React, { useMemo } from "react";
import { useProsodyAnalyzer } from "../hooks/useProsodyAnalyzer";

export default function ProsodyRecorder() {
  const { start, stop, isRecording, summary } = useProsodyAnalyzer({ bufferSize: 2048, storeContour: true });

  const handleStart = async () => {
    try {
      await start();
    } catch (e) {
      console.error('Start failed', e);
      alert('Cannot access microphone. Check permission and HTTPS.');
    }
  };

  const handleStop = async () => {
    try {
      await stop();
    } catch (e) {
      console.error('Stop failed', e);
    }
  };

  const sparkline = useMemo(() => {
    if (!summary?.f0_contour || summary.f0_contour.length < 2) return null;
    const points = summary.f0_contour;
    const w = 360, h = 60;
    const maxF = Math.max(...points.map(p => (p.f0 || 0)));
    const minF = Math.min(...points.map(p => (p.f0 || maxF)));
    const range = Math.max(1, maxF - minF);
    const path = points.map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p.f0 || minF) - minF) / range * h;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <path d={path} stroke="#2563EB" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }, [summary]);

  return (
    <div className="p-4 bg-card border rounded space-y-4">
      <div className="flex gap-2">
        <button onClick={handleStart} disabled={isRecording} className="px-4 py-2 bg-accent text-white rounded">Start</button>
        <button onClick={handleStop} disabled={!isRecording} className="px-4 py-2 bg-destructive text-white rounded">Stop</button>
      </div>

      {summary && (
        <div>
          <h3 className="text-sm font-medium">Prosody Summary</h3>
          <div className="text-xs text-muted-foreground mt-2 space-y-1">
            <div>Duration: {summary.dur_s}s</div>
            <div>F0 mean: {summary.f0_mean ?? '—'} Hz</div>
            <div>F0 stdev: {summary.f0_stdev ?? '—'} Hz</div>
            <div>Energy mean: {summary.energy_mean ?? '—'}</div>
            <div>Pauses: {summary.pause_count} (avg {summary.avg_pause_ms ?? '—'} ms)</div>
            <div>Speech rate: {summary.speech_rate_spm ?? '—'} spm</div>
            <div>Monotony: {summary.monotony_0to1 ?? '—'}</div>
          </div>

          {summary.f0_contour && summary.f0_contour.length >= 10 && (
            <div className="mt-3">
              <div className="text-xs text-muted-foreground mb-1">Pitch contour</div>
              {sparkline}
            </div>
          )}

          <div className="mt-3">
            <div className="text-xs font-medium">Tips</div>
            <ul className="list-disc pl-5 text-xs mt-1">
              {summary.tips.map((t, i) => (<li key={i}>{t}</li>))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
