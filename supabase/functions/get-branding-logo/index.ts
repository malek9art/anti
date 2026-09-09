import { corsHeaders } from '../_shared/cors.ts';
import { adminClient } from '../_shared/client.ts';

let cached: { bytes: Uint8Array; mime: string } | null = null;

function hexToBytes(hex: string): Uint8Array {
  const len = hex.length / 2;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

async function loadLogo(): Promise<{ bytes: Uint8Array; mime: string }> {
  if (cached) return cached;
  const { data, error } = await adminClient()
    .from('branding_assets')
    .select('data,mime')
    .eq('name', 'logo')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'logo row missing');
  const raw = data.data as unknown as string;
  const hex = raw.startsWith('\\x') ? raw.slice(2) : raw;
  cached = { bytes: hexToBytes(hex), mime: (data.mime as string) ?? 'image/png' };
  return cached;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const logo = await loadLogo();
    return new Response(logo.bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': logo.mime,
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
