export interface VideoPlaybackOptions {
  controls?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
}

export type ParsedVideoSource =
  | {
      kind: 'iframe';
      embedUrl: string;
      provider: 'youtube' | 'vimeo' | 'nicovideo' | 'external';
      providerLabel: string;
    }
  | {
      kind: 'native';
      src: string;
      providerLabel: string;
    };

export const DEFAULT_VIDEO_POSTER_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="55%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#090d16"/>
        </linearGradient>
      </defs>
      <rect width="960" height="540" fill="url(#bg)"/>
      <rect x="32" y="32" width="896" height="476" rx="12" fill="none" stroke="rgba(148,163,184,0.14)" stroke-width="1"/>
    </svg>`
  );

/**
 * If a user pastes a full `<iframe ... src="..."></iframe>` embed code snippet,
 * cleanly extract the `src` URL so they don't have to edit HTML attributes manually.
 */
export function extractIframeSrc(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().includes('<iframe')) {
    return trimmed;
  }
  const match = trimmed.match(/\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
  if (!match) return trimmed;
  const extracted = (match[1] || match[2] || '').trim();
  return extracted.replace(/&amp;/g, '&');
}

function extractYouTubeVideoId(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.replace(/^www\./i, '').replace(/^m\./i, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{6,20}$/.test(id) ? id : null;
    }

    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') {
        const v = u.searchParams.get('v');
        return v && /^[a-zA-Z0-9_-]{6,20}$/.test(v) ? v : null;
      }
      const parts = u.pathname.split('/').filter(Boolean);
      if (
        parts.length >= 2 &&
        (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live' || parts[0] === 'v')
      ) {
        const id = parts[1];
        return id && /^[a-zA-Z0-9_-]{6,20}$/.test(id) ? id : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function extractVimeoVideoId(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    const parts = u.pathname.split('/').filter(Boolean);

    if (host === 'vimeo.com' && parts.length >= 1) {
      const candidate = parts[parts.length - 1];
      return /^\d{5,15}$/.test(candidate) ? candidate : null;
    }
    if (host === 'player.vimeo.com' && parts[0] === 'video' && parts[1]) {
      return /^\d{5,15}$/.test(parts[1]) ? parts[1] : null;
    }
  } catch {
    return null;
  }
  return null;
}

function extractNicoVideoId(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.replace(/^www\./i, '').replace(/^sp\./i, '').toLowerCase();
    const parts = u.pathname.split('/').filter(Boolean);

    if (
      (host === 'nicovideo.jp' || host === 'embed.nicovideo.jp') &&
      parts[0] === 'watch' &&
      parts[1]
    ) {
      return /^(?:sm|nm|so)\d+$/.test(parts[1]) ? parts[1] : null;
    }
    if (host === 'nico.ms' && parts[0]) {
      return /^(?:sm|nm|so)\d+$/.test(parts[0]) ? parts[0] : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function parseVideoEmbed(
  rawInput: string | undefined,
  options?: VideoPlaybackOptions
): ParsedVideoSource {
  const raw = (rawInput || '').trim();
  if (!raw) {
    return { kind: 'native', src: '', providerLabel: 'HTML5 Video' };
  }

  const wasIframeTag = raw.toLowerCase().includes('<iframe');
  const cleaned = extractIframeSrc(raw);

  if (
    cleaned.startsWith('blob:') ||
    cleaned.startsWith('data:video/') ||
    cleaned.startsWith('./') ||
    cleaned.startsWith('/')
  ) {
    return { kind: 'native', src: cleaned, providerLabel: '動画ファイル' };
  }

  const ytId = extractYouTubeVideoId(cleaned);
  if (ytId) {
    const controls = options?.controls !== false;
    const autoplay = Boolean(options?.autoplay);
    const loop = Boolean(options?.loop);
    const muted = Boolean(options?.muted || autoplay);

    const params = new URLSearchParams();
    params.set('playsinline', '1');
    params.set('rel', '0');
    if (!controls) params.set('controls', '0');
    if (autoplay) params.set('autoplay', '1');
    if (muted) params.set('mute', '1');
    if (loop) {
      params.set('loop', '1');
      params.set('playlist', ytId);
    }

    return {
      kind: 'iframe',
      embedUrl: `https://www.youtube.com/embed/${ytId}?${params.toString()}`,
      provider: 'youtube',
      providerLabel: 'YouTube',
    };
  }

  const vimeoId = extractVimeoVideoId(cleaned);
  if (vimeoId) {
    const controls = options?.controls !== false;
    const autoplay = Boolean(options?.autoplay);
    const loop = Boolean(options?.loop);
    const muted = Boolean(options?.muted || autoplay);

    const params = new URLSearchParams();
    if (!controls) params.set('controls', '0');
    if (autoplay) params.set('autoplay', '1');
    if (muted) params.set('muted', '1');
    if (loop) params.set('loop', '1');
    const qs = params.toString();

    return {
      kind: 'iframe',
      embedUrl: `https://player.vimeo.com/video/${vimeoId}${qs ? `?${qs}` : ''}`,
      provider: 'vimeo',
      providerLabel: 'Vimeo',
    };
  }

  const nicoId = extractNicoVideoId(cleaned);
  if (nicoId) {
    return {
      kind: 'iframe',
      embedUrl: `https://embed.nicovideo.jp/watch/${nicoId}`,
      provider: 'nicovideo',
      providerLabel: 'ニコニコ動画',
    };
  }

  if (
    wasIframeTag ||
    (/^https?:\/\//i.test(cleaned) &&
      /\/embed\/|player\./i.test(cleaned) &&
      !/\.(mp4|webm|ogg|ogv|mov)(?:[?#]|$)/i.test(cleaned))
  ) {
    return {
      kind: 'iframe',
      embedUrl: cleaned,
      provider: 'external',
      providerLabel: '外部埋め込みプレイヤー',
    };
  }

  return { kind: 'native', src: cleaned, providerLabel: 'HTML5 Video' };
}

export function isIframeVideoSource(rawInput: string | undefined): boolean {
  return parseVideoEmbed(rawInput).kind === 'iframe';
}

let cachedSampleAudioUri: string | null = null;

/**
 * Generates a warm, pleasant 2.2-second acoustic chord chime as a valid 16-bit PCM WAV data URI
 * so newly placed <audio> elements play real sound out of the box offline and export cleanly to ZIP.
 */
export function getSampleAudioDataUri(): string {
  if (cachedSampleAudioUri) return cachedSampleAudioUri;

  const sampleRate = 22050;
  const durationSec = 2.2;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataByteLen = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataByteLen);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // Standard RIFF/WAVE header (Mono, 16-bit PCM)
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLen, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataByteLen, true);

  // Staggered Cmaj9 warm bell arpeggio (C4, E4, G4, B4, D5)
  const notes = [
    { freq: 261.63, onset: 0.0, amp: 0.24 },
    { freq: 329.63, onset: 0.14, amp: 0.21 },
    { freq: 392.0, onset: 0.28, amp: 0.19 },
    { freq: 493.88, onset: 0.42, amp: 0.17 },
    { freq: 587.33, onset: 0.56, amp: 0.16 },
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    for (const note of notes) {
      const dt = t - note.onset;
      if (dt < 0) continue;
      const attack = Math.min(1, dt / 0.015);
      const decay = Math.exp(-dt * 2.35);
      const fundamental = Math.sin(2 * Math.PI * note.freq * dt);
      const overtone = 0.28 * Math.sin(2 * Math.PI * note.freq * 2 * dt) * Math.exp(-dt * 4.2);
      sample += note.amp * attack * decay * (fundamental + overtone);
    }

    // Gentle fade-out at tail to guarantee zero click
    const tailFade = t > durationSec - 0.12 ? Math.max(0, (durationSec - t) / 0.12) : 1;
    const clamped = Math.max(-0.95, Math.min(0.95, sample * tailFade));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const slice = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...slice);
  }

  cachedSampleAudioUri = `data:audio/wav;base64,${btoa(binary)}`;
  return cachedSampleAudioUri;
}
