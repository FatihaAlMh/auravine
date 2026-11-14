"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import ParticleFlowerCanvas from "@/components/ParticleFlowerCanvas";
import { FlowerGift, getFlowerGiftBySlug } from "@/lib/supabase";

export default function GiftReceiverPage() {
  const params = useParams<{ id: string }>();
  const slug = params?.id || "";

  const [gift, setGift] = useState<FlowerGift | null>(null);
  const [loading, setLoading] = useState(true);
  const [seedTapped, setSeedTapped] = useState(false);
  const [bloomCompleted, setBloomCompleted] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadGift() {
      setLoading(true);
      const data = await getFlowerGiftBySlug(slug);
      if (active) {
        setGift(data);
        setLoading(false);
      }
    }
    if (slug) {
      loadGift();
    }
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <main className="min-h-screen w-full flex flex-col items-center justify-center px-6 text-center">
        <div className="h-8 w-8 rounded-full border-2 border-purple-400 border-t-transparent animate-spin mb-4" />
        <p className="text-sm tracking-[0.2em] uppercase text-purple-200/70">
          Awakening your seed...
        </p>
      </main>
    );
  }

  if (!gift) {
    return (
      <main className="min-h-screen w-full flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl sm:text-3xl font-light text-white glow-text mb-3">
          This seed could not be found
        </h1>
        <p className="text-sm text-purple-200/70 font-sans max-w-md mb-8">
          The link may have been mistyped, or this bloom was created in a
          different browser session without a connected database.
        </p>
        <Link
          href="/create"
          className="px-6 py-3 rounded-full bg-purple-600/80 hover:bg-purple-600 text-white font-sans text-xs tracking-widest uppercase transition"
        >
          Create a New Flower
        </Link>
      </main>
    );
  }

  return (
    <main className="relative w-full h-screen overflow-hidden select-none">
      {/* Personalized Greeting at Top */}
      <div
        className={`fixed top-0 left-0 right-0 z-20 text-center px-6 pt-8 sm:pt-12 pointer-events-none transition-opacity duration-[2000ms] ${
          seedTapped ? "opacity-60" : "opacity-100"
        }`}
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 2.25rem)",
        }}
      >
        <p className="max-w-xl mx-auto text-base sm:text-xl md:text-2xl font-light tracking-[0.08em] text-purple-100 glow-text leading-relaxed">
          Hey <span className="italic text-white">{gift.recipient_name}</span>,
          someone special wanted to give you this...
        </p>
      </div>

      {/* Interactive 3D Particle Flower Canvas */}
      <ParticleFlowerCanvas
        primaryColor={gift.primary_color}
        secondaryColor={gift.secondary_color}
        autoBloom={false}
        onSeedTap={() => setSeedTapped(true)}
        onBloomComplete={() => setBloomCompleted(true)}
      />

      {/* Secret Message Revealed After Growth Animation */}
      <div
        className={`fixed left-0 right-0 bottom-0 z-20 text-center px-6 pointer-events-none transition-opacity duration-[3000ms] ease-out ${
          bloomCompleted ? "opacity-100" : "opacity-0"
        }`}
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 7vh)",
        }}
      >
        <p
          className="max-w-2xl mx-auto font-light tracking-[0.14em] text-white leading-relaxed"
          style={{
            fontSize: "clamp(1.05rem, 2.6vw, 1.7rem)",
            textShadow: `0 0 18px ${gift.primary_color}, 0 0 40px ${gift.secondary_color}`,
          }}
        >
          &ldquo;{gift.secret_message}&rdquo;
        </p>

        <div
          className={`mt-6 transition-opacity duration-1000 delay-1000 ${
            bloomCompleted
              ? "opacity-70 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
        >
          <Link
            href="/create"
            className="inline-flex items-center gap-1.5 text-[11px] font-sans tracking-[0.2em] uppercase text-purple-200/70 hover:text-white transition"
          >
            <Sparkles className="w-3 h-3" />
            <span>Send a flower back with Auravine</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
