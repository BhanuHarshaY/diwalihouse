'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './mehfil.module.css';

/**
 * YouTube's own player, on the one tab that is the speaker. The Mehfil never
 * touches the audio: YouTube plays it, visibly, under its terms, and this
 * component reports when each song ends (or can't play) so the queue moves.
 * It mounts only after a tap on this tab, so it never starts sound unasked.
 */

interface YTPlayer {
  loadVideoById(video: string): void;
  playVideo(): void;
  stopVideo(): void;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      host: string;
      width: string;
      height: string;
      videoId?: string | undefined;
      playerVars: Record<string, number>;
      events: {
        onReady: (event: { target: YTPlayer }) => void;
        onStateChange: (event: { data: number }) => void;
        onError: (event: { data: number }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let api: Promise<YTNamespace> | null = null;

function loadYouTube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  api ??= new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      api = null;
      reject(new Error('the YouTube player did not load'));
    };
    document.head.append(script);
  });
  return api;
}

export interface PlayingSong {
  id: number;
  video: string;
}

export function SpeakerPlayer({
  song,
  onEnded,
  onFailed,
}: {
  song: PlayingSong | null;
  onEnded: (song: number) => void;
  onFailed: (song: number) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const ready = useRef(false);
  const current = useRef(song);
  const report = useRef({ onEnded, onFailed });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    report.current = { onEnded, onFailed };
  });

  useEffect(() => {
    let cancelled = false;
    loadYouTube()
      .then((YT) => {
        if (cancelled || !holder.current) return;
        // YouTube replaces this element with its iframe, so React never owns it.
        const mount = document.createElement('div');
        holder.current.append(mount);
        player.current = new YT.Player(mount, {
          host: 'https://www.youtube-nocookie.com',
          width: '100%',
          height: '100%',
          videoId: current.current?.video,
          playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
          events: {
            onReady: (event) => {
              ready.current = true;
              if (current.current) event.target.playVideo();
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.ENDED && current.current) {
                report.current.onEnded(current.current.id);
              }
            },
            onError: () => {
              if (current.current) report.current.onFailed(current.current.id);
            },
          },
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
      ready.current = false;
    };
  }, []);

  const songId = song?.id ?? null;
  const video = song?.video ?? null;
  useEffect(() => {
    const before = current.current;
    current.current = songId !== null && video ? { id: songId, video } : null;
    if (!player.current || !ready.current) return;
    if (video && songId !== before?.id) player.current.loadVideoById(video);
    else if (!video) player.current.stopVideo();
  }, [songId, video]);

  return (
    <div className={styles.player}>
      <div ref={holder} className={styles.playerFrame} data-testid="speaker-player" />
      {failed ? (
        <p className={`type-small ${styles.playerNote}`}>
          The YouTube player couldn’t load on this device. Check its connection, then reload.
        </p>
      ) : !song ? (
        <p className={`type-small ${styles.playerNote}`}>Waiting for the next request…</p>
      ) : null}
    </div>
  );
}
