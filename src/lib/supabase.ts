import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";

export type FlowerStyle = "lily" | "rose" | "lotus" | "bouquet";

export interface FlowerGift {
  id?: string;
  slug: string;
  recipient_name: string;
  secret_message: string;
  primary_color: string;
  secondary_color: string;
  flower_style?: FlowerStyle;
  created_at?: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured =
  Boolean(supabaseUrl && supabaseAnonKey) &&
  !supabaseUrl.includes("your-project-id");

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const LOCAL_STORAGE_KEY = "auravine_local_flowers";

/**
 * Encodes a flower gift into a compact, UTF-8 safe base64url string
 * so shared links still work across devices even before Supabase is configured.
 */
export function encodeGiftPayload(
  gift: Pick<
    FlowerGift,
    | "recipient_name"
    | "secret_message"
    | "primary_color"
    | "secondary_color"
    | "flower_style"
  >
): string {
  const json = JSON.stringify({
    n: gift.recipient_name,
    m: gift.secret_message,
    p: gift.primary_color,
    s: gift.secondary_color,
    t: gift.flower_style || "lily",
  });
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeGiftPayload(
  slug: string,
  encoded: string | null
): FlowerGift | null {
  if (!encoded) return null;
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4 ? "=".repeat(4 - (base64.length % 4)) : "";
    const binary = atob(base64 + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed?.n || !parsed?.m) return null;
    return {
      slug,
      recipient_name: String(parsed.n),
      secret_message: String(parsed.m).slice(0, 150),
      primary_color: String(parsed.p || "#9d5cff"),
      secondary_color: String(parsed.s || "#38bdf8"),
      flower_style: (parsed.t as FlowerStyle) || "lily",
    };
  } catch {
    return null;
  }
}

/**
 * Saves a customized flower gift to Supabase (with a shareable URL-encoded
 * + localStorage fallback when Supabase credentials are not configured).
 */
export async function createFlowerGift(
  input: Omit<FlowerGift, "id" | "slug" | "created_at">
): Promise<{ slug: string; path: string; gift: FlowerGift }> {
  const slug = nanoid(10);
  const record: FlowerGift = {
    slug,
    recipient_name: input.recipient_name.trim(),
    secret_message: input.secret_message.trim().slice(0, 150),
    primary_color: input.primary_color,
    secondary_color: input.secondary_color,
    flower_style: input.flower_style || "lily",
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    const basePayload = {
      slug: record.slug,
      recipient_name: record.recipient_name,
      secret_message: record.secret_message,
      primary_color: record.primary_color,
      secondary_color: record.secondary_color,
    };

    let { data, error } = await supabase
      .from("flowers")
      .insert([{ ...basePayload, flower_style: record.flower_style }])
      .select()
      .single();

    // Graceful fallback if existing Supabase table hasn't added flower_style column yet
    if (error && error.message?.toLowerCase().includes("flower_style")) {
      const retry = await supabase
        .from("flowers")
        .insert([basePayload])
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      throw new Error(error.message || "Failed to save flower gift to database.");
    }

    return {
      slug: data.slug,
      path: `/gift/${data.slug}`,
      gift: data as FlowerGift,
    };
  }

  // Fallback: save to localStorage AND embed payload in URL so links work across devices
  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    const store: Record<string, FlowerGift> = raw ? JSON.parse(raw) : {};
    store[slug] = record;
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  }

  const encoded = encodeGiftPayload(record);
  return { slug, path: `/gift/${slug}?d=${encoded}`, gift: record };
}

/**
 * Fetches a flower gift by its unique URL slug from Supabase,
 * falling back to URL-encoded payload or localStorage.
 */
export async function getFlowerGiftBySlug(
  slug: string,
  encodedPayload?: string | null
): Promise<FlowerGift | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from("flowers")
      .select("*")
      .eq("slug", slug)
      .single();

    if (!error && data) {
      return data as FlowerGift;
    }
  }

  const fromUrl = decodeGiftPayload(slug, encodedPayload ?? null);
  if (fromUrl) {
    return fromUrl;
  }

  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const store: Record<string, FlowerGift> = JSON.parse(raw);
      if (store[slug]) {
        return store[slug];
      }
    }
  }

  return null;
}
