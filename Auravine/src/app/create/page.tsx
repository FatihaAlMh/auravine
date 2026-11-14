"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  ArrowLeft,
  Palette,
  Send,
} from "lucide-react";
import ParticleFlowerCanvas from "@/components/ParticleFlowerCanvas";
import { createFlowerGift, isSupabaseConfigured } from "@/lib/supabase";

const PRESET_PALETTES = [
  { name: "Celestial Violet", primary: "#9d5cff", secondary: "#38bdf8" },
  { name: "Rapunzel Gold", primary: "#f59e0b", secondary: "#ec4899" },
  { name: "Midnight Rose", primary: "#f43f5e", secondary: "#c084fc" },
  { name: "Aurora Emerald", primary: "#10b981", secondary: "#38bdf8" },
  { name: "Sakura Moon", primary: "#f472b6", secondary: "#fbbf24" },
];

export default function CreateFlowerPage() {
  const [recipientName, setRecipientName] = useState("");
  const [secretMessage, setSecretMessage] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#9d5cff");
  const [secondaryColor, setSecondaryColor] = useState("#38bdf8");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!recipientName.trim()) {
      setErrorMsg("Please enter the recipient's name.");
      return;
    }
    if (!secretMessage.trim()) {
      setErrorMsg("Please write a secret message for the bloom.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { slug } = await createFlowerGift({
        recipient_name: recipientName.trim(),
        secret_message: secretMessage.trim().slice(0, 150),
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      });

      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      setGeneratedUrl(`${origin}/gift/${slug}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden flex flex-col lg:flex-row">
      {/* Live Interactive 3D Particle Flower Preview */}
      <div className="relative w-full lg:w-7/12 h-[44vh] sm:h-[50vh] lg:h-screen lg:fixed lg:right-0 lg:top-0 z-0">
        <ParticleFlowerCanvas
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          autoBloom={true}
        />
        <div className="absolute top-4 right-4 z-10 pointer-events-none px-3.5 py-1.5 rounded-full bg-black/50 border border-white/10 backdrop-blur-md text-[11px] font-sans tracking-widest uppercase text-purple-200/80">
          Live Interactive Preview
        </div>
      </div>

      {/* Left Creator Control Panel */}
      <div className="relative z-10 w-full lg:w-5/12 min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-12 bg-gradient-to-b from-[#080514]/90 via-[#060410]/95 to-black/95 backdrop-blur-xl border-r border-white/10">
        <div>
          <div className="flex items-center justify-between mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-sans tracking-widest uppercase text-purple-300/80 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Link>
            <div className="flex items-center gap-2 text-purple-200">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm tracking-[0.2em] uppercase">
                Auravine Studio
              </span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-light text-white glow-text mb-2">
            Customize Your Bloom
          </h1>
          <p className="text-sm text-purple-200/70 font-sans mb-8">
            Design a one-of-a-kind particle flower. When they open your link, it
            will wait as a glowing seed until they touch it.
          </p>

          <form onSubmit={handleGenerateLink} className="space-y-6 font-sans">
            {/* Recipient Name */}
            <div>
              <label
                htmlFor="recipientName"
                className="block text-xs uppercase tracking-widest text-purple-200/80 mb-2"
              >
                Recipient&apos;s Name
              </label>
              <input
                id="recipientName"
                type="text"
                maxLength={80}
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g., Elena"
                className="w-full rounded-xl bg-white/5 border border-purple-300/20 px-4 py-3 text-white placeholder-purple-300/30 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition"
              />
            </div>

            {/* Secret Message (Max 150 chars) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="secretMessage"
                  className="block text-xs uppercase tracking-widest text-purple-200/80"
                >
                  Secret Message
                </label>
                <span
                  className={`text-xs ${
                    secretMessage.length >= 140
                      ? "text-amber-300"
                      : "text-purple-300/50"
                  }`}
                >
                  {secretMessage.length} / 150
                </span>
              </div>
              <textarea
                id="secretMessage"
                rows={3}
                maxLength={150}
                required
                value={secretMessage}
                onChange={(e) => setSecretMessage(e.target.value)}
                placeholder="Every great bloom begins as a small, quiet seed..."
                className="w-full rounded-xl bg-white/5 border border-purple-300/20 px-4 py-3 text-white placeholder-purple-300/30 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition resize-none"
              />
            </div>

            {/* Color Pickers */}
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-purple-200/80 mb-3">
                <Palette className="w-3.5 h-3.5 text-purple-400" />
                <span>Petal Colors</span>
              </div>

              {/* Preset Themes */}
              <div className="flex flex-wrap gap-2 mb-4">
                {PRESET_PALETTES.map((preset) => {
                  const active =
                    primaryColor.toLowerCase() ===
                      preset.primary.toLowerCase() &&
                    secondaryColor.toLowerCase() ===
                      preset.secondary.toLowerCase();
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setPrimaryColor(preset.primary);
                        setSecondaryColor(preset.secondary);
                      }}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition ${
                        active
                          ? "border-purple-400 bg-purple-500/20 text-white"
                          : "border-white/10 bg-white/5 text-purple-200/70 hover:bg-white/10"
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{
                          background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})`,
                        }}
                      />
                      <span>{preset.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-purple-300/20 cursor-pointer hover:border-purple-300/40 transition">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-9 h-9 rounded-lg bg-transparent border-0 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs text-purple-200/90 font-medium">
                      Primary Color
                    </div>
                    <div className="text-[11px] text-purple-300/50 uppercase font-mono">
                      {primaryColor}
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-purple-300/20 cursor-pointer hover:border-purple-300/40 transition">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-9 h-9 rounded-lg bg-transparent border-0 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs text-purple-200/90 font-medium">
                      Secondary Color
                    </div>
                    <div className="text-[11px] text-purple-300/50 uppercase font-mono">
                      {secondaryColor}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-200 text-xs">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2.5 py-4 px-6 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white font-medium text-sm tracking-wider uppercase shadow-[0_0_30px_rgba(168,85,247,0.45)] hover:shadow-[0_0_45px_rgba(168,85,247,0.75)] disabled:opacity-50 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                {isSubmitting ? "Planting Seed..." : "Generate Link"}
              </span>
            </button>
          </form>

          {/* Generated Gift URL Card */}
          {generatedUrl && (
            <div className="mt-6 p-5 rounded-2xl bg-purple-950/40 border border-purple-400/30 backdrop-blur-md space-y-3 animate-fadeIn font-sans">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest text-purple-300">
                  Your Gift Link is Ready
                </span>
                {!isSupabaseConfigured && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-400/30">
                    Local Demo Storage
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedUrl}
                  className="w-full text-xs font-mono bg-black/50 border border-white/15 rounded-lg px-3 py-2.5 text-purple-100 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-1 flex justify-end">
                <Link
                  href={new URL(generatedUrl).pathname}
                  className="inline-flex items-center gap-1.5 text-xs text-purple-300 hover:text-white transition"
                >
                  <span>Open Receiver Experience</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        <footer className="pt-8 text-[11px] text-purple-300/40 font-sans">
          Tip: Drag your finger or cursor across the flower preview to ripple
          its petals.
        </footer>
      </div>
    </div>
  );
}
