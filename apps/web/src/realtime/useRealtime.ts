'use client';

import type { ServerMessage } from '@diwali/realtime-protocol';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * One realtime socket, kept open: fetches a fresh single-use ticket for
 * every (re)connection, backs off on failure, and re-sends requests that
 * hadn't been answered when the connection dropped. The rooms deduplicate
 * by request id, so a re-send can never act twice.
 */

export type SocketStatus = 'connecting' | 'open' | 'reconnecting' | 'unavailable' | 'denied';

type Result = Extract<ServerMessage, { t: 'result' }>;

/**
 * `room` is the path under the party: null for the party room itself,
 * `games/<id>` for a game, `courtyard` or `mehfil`. `query` adds plain
 * parameters to the socket URL (the Mehfil's tab id); never credentials.
 */
export function useRealtime(
  partyId: string,
  room: string | null,
  onMessage: (message: ServerMessage) => void,
  query?: Record<string, string> | undefined,
) {
  const search = query ? `&${new URLSearchParams(query).toString()}` : '';
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const socket = useRef<WebSocket | null>(null);
  const pending = useRef(new Map<string, { body: string; resolve: (r: Result) => void }>());
  const handler = useRef(onMessage);
  useEffect(() => {
    handler.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    let stopped = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;

    async function connect() {
      if (stopped) return;
      let ticket: string;
      let url: string;
      try {
        const response = await fetch(`/api/parties/${partyId}/ticket`, { method: 'POST' });
        if (response.status === 503) return setStatus('unavailable');
        if (response.status === 401) return setStatus('denied');
        if (!response.ok) throw new Error(`ticket ${response.status}`);
        ({ ticket, url } = (await response.json()) as { ticket: string; url: string });
      } catch {
        return scheduleRetry();
      }
      if (stopped) return;
      const path = room ? `/parties/${partyId}/${room}/connect` : `/parties/${partyId}/connect`;
      const ws = new WebSocket(`${url}${path}?ticket=${encodeURIComponent(ticket)}${search}`);
      socket.current = ws;
      ws.onopen = () => {
        attempt = 0;
        setStatus('open');
        for (const { body } of pending.current.values()) ws.send(body);
        ping = setInterval(
          () => ws.readyState === WebSocket.OPEN && ws.send('{"t":"ping"}'),
          25_000,
        );
      };
      ws.onmessage = (event) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return;
        }
        if (message.t === 'revoked') {
          // No longer a member: stop for good rather than retry forever.
          stopped = true;
          setStatus('denied');
          ws.close();
          return;
        }
        if (message.t === 'result') {
          pending.current.get(message.id)?.resolve(message);
          pending.current.delete(message.id);
        }
        handler.current(message);
      };
      ws.onclose = () => {
        clearInterval(ping);
        if (socket.current === ws) socket.current = null;
        if (!stopped) scheduleRetry();
      };
    }

    function scheduleRetry() {
      setStatus('reconnecting');
      const delay = Math.min(15_000, 800 * 2 ** attempt) * (0.75 + Math.random() * 0.5);
      attempt += 1;
      retry = setTimeout(connect, delay);
    }

    void connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      clearInterval(ping);
      socket.current?.close();
    };
  }, [partyId, room, search]);

  /** Sends a request and resolves with the room's answer (or a timeout). */
  const request = useCallback(<T extends Record<string, unknown>>(message: T): Promise<Result> => {
    const id = crypto.randomUUID().replaceAll('-', '');
    const body = JSON.stringify({ ...message, id });
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.current.delete(id);
        resolve({ t: 'result', id, ok: false, error: 'timeout' });
      }, 10_000);
      pending.current.set(id, {
        body,
        resolve: (result) => {
          clearTimeout(timer);
          resolve(result);
        },
      });
      if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(body);
    });
  }, []);

  return { status, request };
}
