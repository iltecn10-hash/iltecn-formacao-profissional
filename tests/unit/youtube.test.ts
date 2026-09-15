import { describe, it, expect } from "vitest";
import {
  extractYoutubeVideoId,
  getYoutubeEmbedUrl,
  getYoutubeThumbnailUrl,
} from "@/lib/youtube";

describe("youtube (Fase 10.2)", () => {
  const VARIANTS = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&list=PL123",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?t=30",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  ];

  it.each(VARIANTS)("extrai o id do vídeo de %s", (url) => {
    expect(extractYoutubeVideoId(url)).toBe("dQw4w9WgXcQ");
  });

  it("devolve null para URL que não é do YouTube", () => {
    expect(extractYoutubeVideoId("https://vimeo.com/12345")).toBeNull();
  });

  it("devolve null para uma string que não é uma URL válida", () => {
    expect(extractYoutubeVideoId("não é uma url")).toBeNull();
  });

  it("getYoutubeEmbedUrl monta a URL de embed", () => {
    expect(getYoutubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ"
    );
    expect(getYoutubeEmbedUrl("https://vimeo.com/12345")).toBeNull();
  });

  it("getYoutubeThumbnailUrl monta a URL da miniatura padrão", () => {
    expect(getYoutubeThumbnailUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    );
    expect(getYoutubeThumbnailUrl("https://vimeo.com/12345")).toBeNull();
  });
});
