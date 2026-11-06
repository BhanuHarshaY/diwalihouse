/**
 * YouTube links. The Mehfil stores only a video id and the title YouTube
 * reports for it; playback happens in YouTube's own player, under its terms.
 */

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function isVideoId(id: string): boolean {
  return VIDEO_ID.test(id);
}

/**
 * The video id in a YouTube link, or null. Accepts the forms people paste:
 * watch?v=, youtu.be/, /shorts/, /live/, /embed/, music. and m. hosts.
 */
export function parseVideoId(text: string): string | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, first, second] = url.pathname.split('/');
    if (first === 'watch') id = url.searchParams.get('v');
    else if (first === 'shorts' || first === 'live' || first === 'embed') id = second ?? null;
  }
  return id && isVideoId(id) ? id : null;
}
