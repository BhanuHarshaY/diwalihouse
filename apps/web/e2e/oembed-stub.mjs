// A stand-in for YouTube's oEmbed endpoint during browser tests, so they
// never depend on YouTube. The test Worker is pointed here (OEMBED_BASE).
import { createServer } from 'node:http';

const SONGS = {
  mehfilSongA: { title: 'Test song A', author_name: 'Test channel' },
  mehfilSongB: { title: 'Test song B', author_name: 'Test channel' },
  mehfilSongC: { title: 'Test song C', author_name: 'Test channel' },
};

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname === '/health') return response.end('ok');
  let video = null;
  try {
    video = new URL(url.searchParams.get('url') ?? '').searchParams.get('v');
  } catch {
    // Falls through to "not found".
  }
  // YouTube answers 401 for videos whose owners don't allow embedding.
  if (video === 'noEmbed0000') {
    response.writeHead(401);
    return response.end('Unauthorized');
  }
  const song = video ? SONGS[video] : undefined;
  if (!song) {
    response.writeHead(400);
    return response.end('Bad Request');
  }
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify(song));
}).listen(Number(process.env.PORT ?? 3199));
