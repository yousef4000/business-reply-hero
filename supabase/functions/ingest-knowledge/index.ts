// Ingests a knowledge source (URL, uploaded file, or manual text), extracts text,
// chunks it, embeds via Lovable AI Gateway, and stores chunks in pgvector.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const EMBED_MODEL = "google/gemini-embedding-001";
const EMBED_DIMS = 1536;
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/embeddings";

// ----- Text extraction helpers -----
async function fetchUrlText(url: string): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": "SmartReplyHub/1.0" } });
  if (!r.ok) throw new Error(`Fetch failed: ${r.status}`);
  const html = await r.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  // Lightweight PDF text extraction via unpdf (pure JS, deno-compatible)
  const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : String(text);
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("https://esm.sh/mammoth@1.8.0");
  const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer as ArrayBuffer });
  return result.value || "";
}

async function extractXlsx(bytes: Uint8Array): Promise<string> {
  const XLSX = await import("https://esm.sh/xlsx@0.18.5");
  const wb = XLSX.read(bytes, { type: "array" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    parts.push(`# Sheet: ${name}`);
    parts.push(XLSX.utils.sheet_to_csv(wb.Sheets[name]));
  }
  return parts.join("\n");
}

function chunkText(text: string, target = 800, overlap = 100): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= target) return [clean];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + target, clean.length);
    if (end < clean.length) {
      // try to break on sentence/space
      const slice = clean.slice(i, end);
      const lastDot = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("؟ "), slice.lastIndexOf("! "), slice.lastIndexOf("\n"));
      if (lastDot > target * 0.5) end = i + lastDot + 1;
    }
    chunks.push(clean.slice(i, end).trim());
    if (end >= clean.length) break;
    i = end - overlap;
  }
  return chunks.filter((c) => c.length > 20);
}

async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  // Lovable Gateway supports OpenAI-compatible embeddings.
  const out: number[][] = [];
  // Batch in groups of 20 to keep request size reasonable
  for (let i = 0; i < texts.length; i += 20) {
    const batch = texts.slice(i, i + 20);
    const r = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input: batch, dimensions: EMBED_DIMS }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Embed failed ${r.status}: ${t.slice(0, 300)}`);
    }
    const data = await r.json();
    for (const item of data.data || []) out.push(item.embedding);
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const t0 = performance.now();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    // Auth
    const accessToken = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!accessToken || accessToken === ANON_KEY) return json({ error: "AUTH_REQUIRED" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "AUTH_REQUIRED" }, 401);

    const body = await req.json();
    const { source_type, title, source_url, storage_path, manual_text, original_name } = body ?? {};
    if (!source_type) return json({ error: "source_type required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Create source row
    const { data: src, error: srcErr } = await admin
      .from("knowledge_sources")
      .insert({
        user_id: userId, source_type, title: title || original_name || source_url || "Manual entry",
        source_url, storage_path, original_name, status: "processing",
      })
      .select("id")
      .single();
    if (srcErr || !src) return json({ error: "Failed to create source", details: srcErr?.message }, 500);
    const sourceId = src.id;

    try {
      // Extract text
      let text = "";
      if (source_type === "manual") {
        text = String(manual_text || "");
      } else if (source_type === "url") {
        if (!source_url) throw new Error("source_url required");
        text = await fetchUrlText(source_url);
      } else if (storage_path) {
        const { data: file, error: dlErr } = await admin.storage.from("business-docs").download(storage_path);
        if (dlErr || !file) throw new Error(`Download failed: ${dlErr?.message}`);
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (source_type === "pdf") text = await extractPdf(bytes);
        else if (source_type === "docx") text = await extractDocx(bytes);
        else if (source_type === "xlsx") text = await extractXlsx(bytes);
        else if (source_type === "txt") text = new TextDecoder().decode(bytes);
        else throw new Error(`Unsupported source_type: ${source_type}`);
      } else {
        throw new Error("storage_path or source_url required");
      }

      text = text.trim();
      if (!text) throw new Error("No text extracted");
      // Cap raw text at 200k chars to protect costs
      if (text.length > 200_000) text = text.slice(0, 200_000);

      const chunks = chunkText(text);
      if (!chunks.length) throw new Error("No usable chunks");

      const embeddings = await embedBatch(chunks, LOVABLE_API_KEY);
      if (embeddings.length !== chunks.length) throw new Error("Embedding/chunk mismatch");

      const rows = chunks.map((content, i) => ({
        user_id: userId,
        source_id: sourceId,
        content,
        token_estimate: Math.ceil(content.length / 4),
        embedding: embeddings[i],
      }));
      // Insert in batches of 50
      for (let i = 0; i < rows.length; i += 50) {
        const { error } = await admin.from("knowledge_chunks").insert(rows.slice(i, i + 50));
        if (error) throw new Error(`Chunk insert failed: ${error.message}`);
      }

      await admin.from("knowledge_sources").update({
        status: "ready",
        raw_text: text.slice(0, 50_000),
        char_count: text.length,
        chunk_count: chunks.length,
      }).eq("id", sourceId);

      const ms = Math.round(performance.now() - t0);
      console.log(`[ingest] user=${userId} source=${sourceId} chunks=${chunks.length} chars=${text.length} ms=${ms}`);
      return json({ success: true, source_id: sourceId, chunks: chunks.length, chars: text.length, duration_ms: ms });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("knowledge_sources").update({ status: "error", error_message: msg }).eq("id", sourceId);
      console.error(`[ingest] FAILED source=${sourceId}: ${msg}`);
      return json({ error: "Ingest failed", details: msg, source_id: sourceId }, 500);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
