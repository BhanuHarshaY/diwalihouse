/**
 * Asks YouTube about a video through its public oEmbed endpoint (no API key,
 * no account). That gives the title to show and, by its status, whether the
 * owner allows the video to play outside YouTube.
 */

export type Lookup = (
  video: string,
) => Promise<
  | { ok: true; title: string; channel: string }
  | { ok: false; error: 'not-embeddable' | 'not-found' | 'lookup-failed' }
>;

export function youtubeLookup(base: string, fetcher: typeof fetch = fetch): Lookup {
  return async (video) => {
    const watch = `https://www.youtube.com/watch?v=${video}`;
    let response: Response;
    try {
      response = await fetcher(`${base}/oembed?format=json&url=${encodeURIComponent(watch)}`, {
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      return { ok: false, error: 'lookup-failed' };
    }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: 'not-embeddable' };
    }
    if (response.status === 400 || response.status === 404)
      return { ok: false, error: 'not-found' };
    if (!response.ok) return { ok: false, error: 'lookup-failed' };
    try {
      const body = (await response.json()) as { title?: unknown; author_name?: unknown };
      if (typeof body.title !== 'string') return { ok: false, error: 'lookup-failed' };
      return {
        ok: true,
        title: body.title,
        channel: typeof body.author_name === 'string' ? body.author_name : '',
      };
    } catch {
      return { ok: false, error: 'lookup-failed' };
    }
  };
}
