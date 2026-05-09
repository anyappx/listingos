import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Play, Zap, Crown, Check, Video, Building, TrendingUp } from "lucide-react";

const STEPS = [
  { icon: "📋", title: "Paste your listing URL", desc: "Drop a Zillow or Redfin link. We scrape photos, price, and details automatically." },
  { icon: "🎨", title: "Pick your style", desc: "Choose Modern, Luxury, Energetic, or Minimal. Add your brand kit once, it auto-applies." },
  { icon: "🎬", title: "Get your video in 2 min", desc: "AI generates cinematic motion clips. Both 16:9 and 9:16 formats, ready to post." },
];

const PLANS = [
  {
    name: "Trial",
    price: "Free",
    period: "",
    icon: Zap,
    features: ["1 listing video", "16:9 + 9:16 formats", "Basic brand kit", "Lead capture page", '"Powered by ListingOS" footer'],
    cta: "Start Free",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Solo",
    price: "$29",
    period: "/mo",
    icon: Zap,
    features: ["3 listings/month", "16:9 + 9:16 formats", "Full brand kit", "Lead capture page", "Remove watermark"],
    cta: "Get Started",
    href: "/signup?plan=solo",
    highlighted: false,
  },
  {
    name: "Agent",
    price: "$79",
    period: "/mo",
    icon: Crown,
    features: ["10 listings/month", "16:9 + 9:16 formats", "Full brand kit", "Lead capture page", "Remove watermark", "Priority generation"],
    cta: "Go Agent",
    href: "/signup?plan=agent",
    highlighted: true,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="font-bold text-xl tracking-tight">ListingOS</span>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get started free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-16 text-center">
        <Badge variant="secondary" className="mb-6">
          <Video className="w-3 h-3 mr-1" />
          AI listing videos in under 2 minutes
        </Badge>
        <h1 className="text-5xl font-bold tracking-tight mb-6 leading-tight">
          Turn any listing into a<br />
          <span className="text-primary">cinematic video</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          Paste a Zillow or Redfin URL. Get a branded, ready-to-post video with AI motion, your logo, and a lead-capture page — automatically.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="gap-2">
              Create my first video free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="gap-2">
              <Play className="w-4 h-4" />
              Log in
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground mt-4">No credit card required · 1 free video</p>
      </section>

      {/* Social proof bar */}
      <section className="border-y bg-muted/30 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold">2 min</p>
              <p className="text-sm text-muted-foreground">Average generation time</p>
            </div>
            <div>
              <p className="text-3xl font-bold">16:9 + 9:16</p>
              <p className="text-sm text-muted-foreground">Both formats included</p>
            </div>
            <div>
              <p className="text-3xl font-bold">Fair Housing</p>
              <p className="text-sm text-muted-foreground">Compliant copy, always</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">How it works</h2>
        <p className="text-center text-muted-foreground mb-12">Three steps. Under two minutes.</p>
        <div className="grid grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <div key={i} className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-3xl mx-auto mb-4">
                {step.icon}
              </div>
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center mx-auto mb-3 font-bold">
                {i + 1}
              </div>
              <h3 className="font-semibold mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/30 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Everything agents need</h2>
          <div className="grid grid-cols-3 gap-6">
            {[
              { icon: Video, title: "AI cinematic motion", desc: "Seedance AI transforms static photos into stunning Ken Burns-style motion clips." },
              { icon: Building, title: "Your brand, automatically", desc: "Set up your brand kit once — logo, colors, headshot — and every video applies it." },
              { icon: TrendingUp, title: "Lead capture built in", desc: "Every video gets a shareable landing page with a lead form. Leads hit your inbox instantly." },
            ].map((f, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <f.icon className="w-8 h-8 text-primary mb-3" />
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-4 py-20" id="pricing">
        <h2 className="text-3xl font-bold text-center mb-4">Simple pricing</h2>
        <p className="text-center text-muted-foreground mb-12">Start free. Upgrade when you need more.</p>
        <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto">
          {PLANS.map((plan) => (
            <Card key={plan.name} className={plan.highlighted ? "border-primary shadow-lg relative" : ""}>
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="text-xs">Most popular</Badge>
                </div>
              )}
              <CardContent className="pt-8 pb-6">
                <div className="flex items-center gap-2 mb-1">
                  <plan.icon className="w-4 h-4" />
                  <span className="font-semibold">{plan.name}</span>
                </div>
                <p className="text-3xl font-bold mb-1">
                  {plan.price}
                  <span className="text-base font-normal text-muted-foreground">{plan.period}</span>
                </p>
                <ul className="space-y-2 my-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href}>
                  <Button className="w-full" variant={plan.highlighted ? "default" : "outline"}>
                    {plan.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground py-16">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to make your listings stand out?</h2>
          <p className="text-primary-foreground/80 mb-8">Join agents using ListingOS to create professional listing videos in minutes.</p>
          <Link href="/signup">
            <Button size="lg" variant="secondary" className="gap-2">
              Create your first video free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">ListingOS</span>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-foreground">Log in</Link>
            <Link href="/signup" className="hover:text-foreground">Sign up</Link>
            <Link href="#pricing" className="hover:text-foreground">Pricing</Link>
          </div>
          <p>© {new Date().getFullYear()} ListingOS</p>
        </div>
      </footer>
    </div>
  );
}
