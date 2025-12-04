import type { VercelRequest, VercelResponse } from '@vercel/node';

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  const origin = String(req.headers.origin || '');
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  
  if (process.env.NODE_ENV === 'development') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.trim().length === 0) {
      console.error('❌ OpenAI API key not configured for prosody analysis');
      return res.status(500).json({ 
        error: 'Prosody analysis service not configured',
        message: 'OpenAI API key is missing. Please configure OPENAI_API_KEY environment variable.'
      });
    }

    // Read raw audio data from request
    const chunks: Buffer[] = [];
    for await (const chunk of req as any) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);
    
    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({ error: 'No audio data provided' });
    }

    console.log('🎤 Processing audio for prosody analysis:', {
      size: audioBuffer.length,
      contentType: req.headers['content-type']
    });

    // Step 1: Transcribe audio with Whisper
    const transcription = await transcribeAudio(audioBuffer, req.headers['content-type'] as string);
    
    // Step 2: Analyze prosody from transcription
    const analysis = analyzeProsody(transcription);

    console.log('✅ Prosody analysis completed:', {
      transcription: transcription.text.substring(0, 50) + '...',
      overall_score: analysis.overall_score
    });

    return res.status(200).json({
      success: true,
      transcription: transcription.text,
      duration: transcription.duration,
      prosody_analysis: analysis
    });

  } catch (error: any) {
    console.error('❌ Prosody analysis failed:', error);
    return res.status(500).json({
      error: 'Prosody analysis failed',
      message: error.message || 'Unknown error occurred'
    });
  }
}

// Transcribe audio using OpenAI Whisper
async function transcribeAudio(audioBuffer: Buffer, contentType: string) {
  try {
    // Create FormData with audio blob
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: contentType || 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Force English transcription only
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word'); // Request word-level timestamps
    // Prompt to preserve exact speech without grammar correction
    formData.append('prompt', 'Transcribe exactly as spoken, including any grammar mistakes, filler words, and hesitations.');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData as any
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Whisper API error:', response.status, errorText);
      throw new Error(`Whisper transcription failed: ${response.status}`);
    }

    const result = await response.json();
    
    return {
      text: result.text || '',
      duration: result.duration || 0,
      language: result.language || 'en',
      segments: result.segments || [],
      words: result.words || [] // Word-level timestamps
    };
  } catch (error) {
    console.error('❌ Transcription failed:', error);
    throw new Error('Failed to transcribe audio');
  }
}

// Analyze prosody metrics from transcription
function analyzeProsody(transcription: any) {
  const { text, duration, segments, words: wordTimestamps } = transcription;
  
  // Calculate word count and speaking rate
  const words = text.trim().split(/\s+/);
  const wordCount = words.length;
  const speakingRate = duration > 0 ? (wordCount / duration) * 60 : 0; // words per minute
  
  // Analyze pronunciation (based on transcription confidence if available)
  const pronunciation = calculatePronunciationScore(segments, text);
  
  // Analyze rhythm (based on speaking rate)
  const rhythm = calculateRhythmScore(speakingRate, duration);
  
  // Analyze intonation (based on sentence patterns)
  const intonation = calculateIntonationScore(text);
  
  // Analyze fluency (based on hesitations and pace)
  const fluency = calculateFluencyScore(text, speakingRate);
  
  // Analyze word-level pronunciation
  const wordAnalysis = analyzeWordLevel(wordTimestamps, text);
  
  // Calculate overall score
  const overall_score = (pronunciation * 0.3 + rhythm * 0.25 + intonation * 0.25 + fluency * 0.2);
  
  return {
    overall_score: Math.round(overall_score * 100) / 100,
    pronunciation_score: Math.round(pronunciation * 100) / 100,
    rhythm_score: Math.round(rhythm * 100) / 100,
    intonation_score: Math.round(intonation * 100) / 100,
    fluency_score: Math.round(fluency * 100) / 100,
    speaking_rate: Math.round(speakingRate * 10) / 10,
    word_count: wordCount,
    duration: Math.round(duration * 10) / 10,
    detailed_feedback: generateFeedback(pronunciation, rhythm, intonation, fluency, speakingRate, wordAnalysis, text)
  };
}

// Calculate pronunciation score from segments
function calculatePronunciationScore(segments: any[], text: string): number {
  if (!segments || segments.length === 0) {
    // Fallback: estimate from text clarity
    const hasComplexWords = /\b\w{8,}\b/.test(text);
    return hasComplexWords ? 0.75 : 0.80;
  }
  
  // Use average confidence from segments if available
  const avgConfidence = segments.reduce((sum, seg) => sum + (seg.confidence || 0.8), 0) / segments.length;
  return Math.max(0.5, Math.min(1.0, avgConfidence));
}

// Calculate rhythm score based on speaking rate
function calculateRhythmScore(speakingRate: number, duration: number): number {
  // Ideal speaking rate: 120-160 words per minute
  const idealMin = 100;
  const idealMax = 180;
  const optimal = 140;
  
  if (speakingRate < idealMin) {
    // Too slow
    return Math.max(0.5, speakingRate / idealMin);
  } else if (speakingRate > idealMax) {
    // Too fast
    return Math.max(0.5, idealMax / speakingRate);
  } else {
    // Within ideal range - score based on distance from optimal
    const distance = Math.abs(speakingRate - optimal);
    const maxDistance = Math.max(optimal - idealMin, idealMax - optimal);
    return 1.0 - (distance / maxDistance) * 0.3;
  }
}

// Calculate intonation score from text patterns
function calculateIntonationScore(text: string): number {
  let score = 0.7; // Base score
  
  // Check for variety in sentence types
  const hasQuestions = /\?/.test(text);
  const hasExclamations = /!/.test(text);
  const hasStatements = /\./.test(text);
  
  if (hasQuestions) score += 0.1;
  if (hasExclamations) score += 0.1;
  if (hasStatements) score += 0.05;
  
  // Check for sentence length variety
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 1) {
    const lengths = sentences.map(s => s.trim().split(/\s+/).length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    if (variance > 5) score += 0.05; // Bonus for variety
  }
  
  return Math.min(1.0, Math.max(0.5, score));
}

// Calculate fluency score
function calculateFluencyScore(text: string, speakingRate: number): number {
  let score = 0.8; // Base score
  
  // Detect filler words
  const fillerWords = ['um', 'uh', 'er', 'ah', 'like', 'you know', 'so', 'well'];
  const textLower = text.toLowerCase();
  let fillerCount = 0;
  
  fillerWords.forEach(filler => {
    const matches = textLower.match(new RegExp(`\\b${filler}\\b`, 'g'));
    if (matches) fillerCount += matches.length;
  });
  
  const words = text.split(/\s+/);
  const fillerRatio = fillerCount / words.length;
  
  // Penalize excessive fillers
  if (fillerRatio > 0.1) {
    score -= (fillerRatio - 0.1) * 2;
  }
  
  // Detect repetitions
  let repetitions = 0;
  for (let i = 1; i < words.length; i++) {
    if (words[i].toLowerCase() === words[i - 1].toLowerCase()) {
      repetitions++;
    }
  }
  const repetitionRatio = repetitions / words.length;
  score -= repetitionRatio * 0.5;
  
  // Bonus for good speaking rate
  if (speakingRate >= 120 && speakingRate <= 160) {
    score += 0.1;
  }
  
  return Math.min(1.0, Math.max(0.4, score));
}

// Analyze text content for specific feedback
function analyzeTextContent(text: string) {
  const analysis: any = {
    fillerWords: [],
    difficultWords: [],
    sentenceStructure: '',
    specificTips: []
  };
  
  const textLower = text.toLowerCase();
  const words = text.split(/\s+/);
  
  // Detect filler words with context
  const fillerPatterns = [
    { word: 'um', tip: 'Pause silently instead of saying "um"' },
    { word: 'uh', tip: 'Take a breath instead of "uh"' },
    { word: 'like', tip: 'Remove "like" - it weakens your message' },
    { word: 'you know', tip: 'Trust that your listener understands' },
    { word: 'actually', tip: 'Often unnecessary - just state your point' },
    { word: 'basically', tip: 'Get straight to the point' }
  ];
  
  fillerPatterns.forEach(({ word, tip }) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      analysis.fillerWords.push({
        word,
        count: matches.length,
        tip
      });
    }
  });
  
  // Detect difficult pronunciation patterns with examples
  const difficultPatterns = [
    { pattern: /\bth\w+/gi, sound: 'TH', example: 'the, think, through', tip: 'Put your tongue between your teeth' },
    { pattern: /\w+ed\b/gi, sound: 'Past tense -ED', example: 'walked, played, wanted', tip: 'Pronounce as /t/, /d/, or /ɪd/ depending on the word' },
    { pattern: /\w+s\b/gi, sound: 'Plural -S', example: 'cats, dogs, houses', tip: 'Clear /s/ or /z/ sound at the end' },
    { pattern: /\bw\w+/gi, sound: 'W sound', example: 'want, would, work', tip: 'Round your lips like saying "oo"' }
  ];
  
  difficultPatterns.forEach(({ pattern, sound, example, tip }) => {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      const uniqueWords = [...new Set(matches.map(w => w.toLowerCase()))].slice(0, 3);
      if (uniqueWords.length > 0) {
        analysis.difficultWords.push({
          sound,
          words: uniqueWords,
          tip
        });
      }
    }
  });
  
  // Analyze sentence structure
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length === 1) {
    analysis.sentenceStructure = 'single sentence';
    analysis.specificTips.push('Try breaking longer thoughts into shorter sentences for clarity');
  } else if (sentences.length > 3) {
    analysis.sentenceStructure = 'multiple sentences';
    analysis.specificTips.push('Good use of multiple sentences - keep varying your sentence length');
  }
  
  // Check for questions
  if (/\?/.test(text)) {
    analysis.specificTips.push('Remember to raise your voice at the end of questions');
  }
  
  return analysis;
}

// Analyze word-level pronunciation
function analyzeWordLevel(wordTimestamps: any[], text: string) {
  if (!wordTimestamps || wordTimestamps.length === 0) {
    return [];
  }
  
  const wordAnalysis: any[] = [];
  
  // Common pronunciation issues for non-native speakers
  const difficultPatterns = [
    { pattern: /th/i, issue: 'TH sound', suggestion: 'Place tongue between teeth' },
    { pattern: /r$/i, issue: 'Final R', suggestion: 'Curl tongue slightly for R sound' },
    { pattern: /ed$/i, issue: 'Past tense', suggestion: 'Pronounce -ed as /d/, /t/, or /ɪd/' },
    { pattern: /s$/i, issue: 'Plural S', suggestion: 'Clear S sound at word end' },
    { pattern: /v/i, issue: 'V sound', suggestion: 'Touch upper teeth to lower lip' },
    { pattern: /w/i, issue: 'W sound', suggestion: 'Round lips for W' }
  ];
  
  wordTimestamps.forEach((wordData, index) => {
    const word = wordData.word || '';
    const wordClean = word.trim().toLowerCase();
    
    // Check for difficult patterns
    const issues = difficultPatterns.filter(p => p.pattern.test(wordClean));
    
    if (issues.length > 0) {
      // Estimate pronunciation score based on word complexity
      const baseScore = 0.75;
      const penalty = issues.length * 0.05;
      const score = Math.max(0.5, baseScore - penalty);
      
      wordAnalysis.push({
        word: word.trim(),
        start: wordData.start,
        end: wordData.end,
        score: Math.round(score * 100),
        issues: issues.map(i => ({
          type: i.issue,
          suggestion: i.suggestion
        }))
      });
    }
  });
  
  // Limit to top 5 most problematic words
  return wordAnalysis
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);
}

// Generate detailed feedback with specific scores and context
function generateFeedback(pronunciation: number, rhythm: number, intonation: number, fluency: number, speakingRate: number, wordAnalysis: any[] = [], text: string = '') {
  const feedback: any = {
    strengths: [],
    improvements: []
  };
  
  // Convert to percentages for clearer feedback
  const pronPct = Math.round(pronunciation * 100);
  const rhythmPct = Math.round(rhythm * 100);
  const intonPct = Math.round(intonation * 100);
  const fluencyPct = Math.round(fluency * 100);
  
  // Analyze text for specific issues
  const textAnalysis = analyzeTextContent(text);
  
  // Find weakest area for targeted improvement
  const scores = [
    { name: 'pronunciation', value: pronunciation, pct: pronPct },
    { name: 'rhythm', value: rhythm, pct: rhythmPct },
    { name: 'intonation', value: intonation, pct: intonPct },
    { name: 'fluency', value: fluency, pct: fluencyPct }
  ];
  const weakest = scores.reduce((min, curr) => curr.value < min.value ? curr : min);
  
  // Pronunciation feedback - specific to score and content
  if (pronunciation >= 0.85) {
    feedback.strengths.push(`Excellent pronunciation clarity (${pronPct}%)`);
  } else if (pronunciation >= 0.70) {
    feedback.strengths.push(`Good pronunciation overall (${pronPct}%)`);
  } else if (pronunciation >= 0.60) {
    // Add specific tips based on difficult words found
    if (textAnalysis.difficultWords.length > 0) {
      const firstDifficult = textAnalysis.difficultWords[0];
      feedback.improvements.push(`Pronunciation at ${pronPct}% - Focus on ${firstDifficult.sound} in words like "${firstDifficult.words.join(', ')}". ${firstDifficult.tip}`);
    } else {
      feedback.improvements.push(`Pronunciation at ${pronPct}% - Focus on consonant sounds at word endings`);
    }
  } else {
    if (textAnalysis.difficultWords.length > 0) {
      const firstDifficult = textAnalysis.difficultWords[0];
      feedback.improvements.push(`Pronunciation needs work (${pronPct}%) - Start with ${firstDifficult.sound}: ${firstDifficult.tip}`);
    } else {
      feedback.improvements.push(`Pronunciation needs work (${pronPct}%) - Practice each word slowly and clearly`);
    }
  }
  
  // Rhythm feedback - specific to speaking rate
  if (rhythm >= 0.80) {
    feedback.strengths.push(`Natural speaking rhythm (${rhythmPct}%) at ${Math.round(speakingRate)} words/min`);
  } else {
    if (speakingRate < 100) {
      feedback.improvements.push(`Rhythm at ${rhythmPct}% - Speaking rate is ${Math.round(speakingRate)} wpm (try 120-140 wpm)`);
    } else if (speakingRate > 180) {
      feedback.improvements.push(`Rhythm at ${rhythmPct}% - Speaking too fast at ${Math.round(speakingRate)} wpm (aim for 120-160 wpm)`);
    } else {
      feedback.improvements.push(`Rhythm at ${rhythmPct}% - Work on consistent pacing between words`);
    }
  }
  
  // Intonation feedback - specific to score
  if (intonation >= 0.80) {
    feedback.strengths.push(`Good intonation patterns (${intonPct}%)`);
  } else if (intonation >= 0.65) {
    feedback.improvements.push(`Intonation at ${intonPct}% - Add more tone variation to emphasize key words`);
  } else {
    feedback.improvements.push(`Intonation needs improvement (${intonPct}%) - Practice making your voice go up and down more`);
  }
  
  // Fluency feedback - specific to score and filler words found
  if (fluency >= 0.80) {
    feedback.strengths.push(`Fluent speech with good flow (${fluencyPct}%)`);
  } else if (fluency >= 0.65) {
    if (textAnalysis.fillerWords.length > 0) {
      const topFiller = textAnalysis.fillerWords[0];
      feedback.improvements.push(`Fluency at ${fluencyPct}% - You said "${topFiller.word}" ${topFiller.count} time${topFiller.count > 1 ? 's' : ''}. ${topFiller.tip}`);
    } else {
      feedback.improvements.push(`Fluency at ${fluencyPct}% - Work on smoother transitions between ideas`);
    }
  } else {
    if (textAnalysis.fillerWords.length > 0) {
      const fillerList = textAnalysis.fillerWords.map((f: any) => `"${f.word}" (${f.count}x)`).join(', ');
      feedback.improvements.push(`Fluency needs work (${fluencyPct}%) - Reduce filler words: ${fillerList}`);
    } else {
      feedback.improvements.push(`Fluency needs work (${fluencyPct}%) - Practice smoother transitions and reduce hesitations`);
    }
  }
  
  // Add specific tips from text analysis
  if (textAnalysis.specificTips && textAnalysis.specificTips.length > 0) {
    textAnalysis.specificTips.forEach((tip: string) => {
      feedback.improvements.push(tip);
    });
  }
  
  // Add priority improvement based on weakest area
  if (weakest.value < 0.70) {
    feedback.improvements.unshift(`🎯 Priority: Improve ${weakest.name} (currently ${weakest.pct}%)`);
  }
  
  // Add word-level analysis to specific_issues
  if (wordAnalysis.length > 0) {
    feedback.specific_issues = wordAnalysis.map(wa => ({
      type: 'pronunciation',
      word: wa.word,
      severity: wa.score < 60 ? 'high' : wa.score < 75 ? 'medium' : 'low',
      feedback: `Pronunciation score: ${wa.score}%`,
      suggestion: wa.issues.map((i: any) => i.suggestion).join('; ')
    }));
  }
  
  return feedback;
}
