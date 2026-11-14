"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Heart, ArrowRight } from "lucide-react";
import ParticleFlowerCanvas from "@/components/ParticleFlowerCanvas";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden flex flex-col justify-between">
      {/* Interactive 3D Particle Flower Backdrop */}
      <div className="fixed inset-0 z-0 opacity-75">
        <ParticleFlowerCanvas
          primaryColor="#9d5cff"
          secondaryColor="#38bdf8"
          autoBloom={true}
        />
      </div>

      {/* Subtle vignette overlay for readability */}
      <div className="fixed inset-0 z-10 pointer-events-none bg-gradient-to-b from-black/60 via-transparent to-black/85" />

      {/* Top Navigation */}
      <header className="relative z-20 flex items-center justify-between px-6 sm:px-12 py-6 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.4)]">
            <Sparkles className="w-4 h-4" />
          </span>
          <span className="text-xl tracking-[0.22em] uppercase font-light text-purple-100">
            Auravine
          </span>
        </div>

        <Link
          href="/create"
          className="text-xs sm:text-sm tracking-[0.18em] uppercase px-4 py-2 rounded-full border border-purple-300/25 bg-white/5 hover:bg-white/10 backdrop-blur-md transition"
        >
          Create Yours
        </Link>
      </header>

      {/* Center / Bottom Hero Content */}
      <section className="relative z-20 flex flex-col items-center text-center px-6 pb-16 pt-28 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950/50 border border-purple-400/25 text-purple-200/90 text-xs tracking-[0.18em] uppercase mb-6 backdrop-blur-md">
          <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400/40" />
          <span>A Digital Bloom That Never Wilts</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-light tracking-wide leading-tight text-white glow-text mb-6">
          Plant a quiet seed for{" "}
          <span className="italic text-purple-200">someone special</span>.
        </h1>

        <p className="text-base sm:text-lg text-purple-100/75 max-w-xl font-sans font-light leading-relaxed mb-10">
          Craft a living constellation of 23,800 glowing particles in their
          favorite colors, hide a secret message inside the bloom, and send a
          private link they can awaken with a single touch.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/create"
            className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white font-sans text-sm sm:text-base font-medium tracking-wider uppercase shadow-[0_0_35px_rgba(168,85,247,0.55)] hover:shadow-[0_0_55px_rgba(168,85,247,0.85)] hover:scale-[1.02] active:scale-[0.99] transition-all"
          >
            <span>Create a Flower</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <p className="mt-6 text-xs text-purple-300/50 font-sans tracking-widest uppercase">
          Touch or move your cursor across the petals above to interact
        </p>
      </section>
    </main>
  );
}
