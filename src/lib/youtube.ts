/**
 * Utilitários para o vídeo didático por etapa (Fase 10.2). Só o YouTube tem
 * player embutido por ora (decisão do usuário ao aprovar o escopo da
 * subfase) — outros `provider` caem para um link simples em
 * `mission-step-row.tsx`, sem quebrar nada.
 */

/**
 * Extrai o ID do vídeo de qualquer formato comum de URL do YouTube:
 * watch?v=, youtu.be/, /embed/ e /shorts/, com ou sem `www.`/`m.` e com
 * parâmetros extras (playlist, tempo, etc.). Devolve `null` para qualquer
 * URL que não seja reconhecidamente do YouTube.
 */
export function extractYoutubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");

  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1).split("/")[0];
    return id || null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parsed.pathname === "/watch") {
      return parsed.searchParams.get("v");
    }
    const embedMatch = parsed.pathname.match(/^\/embed\/([^/]+)/);
    if (embedMatch) return embedMatch[1];
    const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/]+)/);
    if (shortsMatch) return shortsMatch[1];
  }

  return null;
}

/** URL pronta para um `<iframe>`, ou `null` se a URL não for do YouTube. */
export function getYoutubeEmbedUrl(url: string): string | null {
  const id = extractYoutubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

/** Miniatura padrão do YouTube para a URL, ou `null` se não for do YouTube. */
export function getYoutubeThumbnailUrl(url: string): string | null {
  const id = extractYoutubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}
