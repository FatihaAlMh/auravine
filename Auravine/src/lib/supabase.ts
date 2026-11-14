import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";

export interface FlowerGift {
  id?: string;
  slug: string;
  recipient_name: string;
  secret_message: string;
  primary_color: string;
  secondary_color: string;
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
 * Saves a customized flower gift to Supabase (with a localStorage fallback
 * when running locally without Supabase credentials configured).
 */
export async function createFlowerGift(
  input: Omit<FlowerGift, "id" | "slug" | "created_at">
): Promise<{ slug: string; gift: FlowerGift }> {
  const slug = nanoid(10);
  const record: FlowerGift = {
    slug,
    recipient_name: input.recipient_name.trim(),
    secret_message: input.secret_message.trim().slice(0, 150),
    primary_color: input.primary_color,
    secondary_color: input.secondary_color,
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    const { data, error } = await supabase
      .from("flowers")
      .insert([
        {
          slug: record.slug,
          recipient_name: record.recipient_name,
          secret_message: record.secret_message,
          primary_color: record.primary_color,
          secondary_color: record.secondary_color,
        },
      ])
      .select()
      .single();

    if (error) {
      throw new Error(error.message || "Failed to save flower gift to database.");
    }

    return { slug: data.slug, gift: data as FlowerGift };
  }

  // Fallback to localStorage for instant local previewing without credentials
  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    const store: Record<string, FlowerGift> = raw ? JSON.parse(raw) : {};
    store[slug] = record;
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  }

  return { slug, gift: record };
}

/**
 * Fetches a flower gift by its unique URL slug from Supabase
 * (or localStorage fallback if running in local demo mode).
 */
export async function getFlowerGiftBySlug(
  slug: string
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
