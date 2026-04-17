function buildCorsHeaders(origin, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || '*';
  const localhostMatch = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
  const allowOrigin = origin && (origin === allowedOrigin || localhostMatch.test(origin))
    ? origin
    : allowedOrigin;

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function jsonResponse(data, { status = 200, origin = '', env } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...buildCorsHeaders(origin, env)
    }
  });
}

async function handleSpeak(request, env) {
  const origin = request.headers.get('Origin') || '';

  if (!env.ELEVENLABS_API_KEY) {
    return jsonResponse({ error: 'Worker secret ELEVENLABS_API_KEY is not configured.' }, { status: 500, origin, env });
  }

  if (!env.DEFAULT_VOICE_ID) {
    return jsonResponse({ error: 'Worker variable DEFAULT_VOICE_ID is not configured.' }, { status: 500, origin, env });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, { status: 400, origin, env });
  }

  const text = String(payload?.text || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return jsonResponse({ error: 'Text is required.' }, { status: 400, origin, env });
  }

  if (text.length > 280) {
    return jsonResponse({ error: 'Text is too long. Keep selections short.' }, { status: 400, origin, env });
  }

  const voiceId = String(payload?.voiceId || env.DEFAULT_VOICE_ID).trim();
  const modelId = String(payload?.modelId || env.DEFAULT_MODEL_ID || 'eleven_multilingual_v2').trim();

  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true
      }
    })
  });

  if (!upstream.ok) {
    const details = await upstream.text();
    return jsonResponse({
      error: 'ElevenLabs request failed.',
      status: upstream.status,
      details: details.slice(0, 500)
    }, { status: 502, origin, env });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
      ...buildCorsHeaders(origin, env)
    }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(origin, env)
      });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse({ ok: true, worker: 'kidsmaths-tts-proxy' }, { origin, env });
    }

    if (request.method === 'POST' && url.pathname === '/v1/speak') {
      return handleSpeak(request, env);
    }

    return jsonResponse({ error: 'Not found.' }, { status: 404, origin, env });
  }
};
