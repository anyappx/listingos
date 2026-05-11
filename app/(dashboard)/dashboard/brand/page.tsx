"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, Save, CheckCircle2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";


const GOOGLE_FONTS = [
  "Inter", "Roboto", "Playfair Display", "Montserrat", "Lato",
  "Raleway", "Oswald", "Merriweather", "Nunito", "Poppins",
];

export default function BrandPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#1A2E4A");
  const [accentColor, setAccentColor] = useState("#F5A623");
  const [font, setFont] = useState("Inter");
  const [agentName, setAgentName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [brokerage, setBrokerage] = useState("");
  const [phone, setPhone] = useState("");
  const [voiceExamples, setVoiceExamples] = useState("");
  const [analyzingVoice, setAnalyzingVoice] = useState(false);
  const [voiceProfile, setVoiceProfile] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/brand");
        const { brandKit } = await res.json();
        if (brandKit) {
          setLogoUrl(brandKit.logo_url);
          setHeadshotUrl(brandKit.headshot_url);
          setPrimaryColor(brandKit.primary_color || "#1A2E4A");
          setAccentColor(brandKit.accent_color || "#F5A623");
          setFont(brandKit.font || "Inter");
          setAgentName(brandKit.agent_name || "");
          setLicenseNumber(brandKit.license_number || "");
          setBrokerage(brandKit.brokerage || "");
          setPhone(brandKit.phone || "");
          setVoiceProfile(brandKit.voice_profile ?? null);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const onDropLogo = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const path = `brand/${user.id}/logo.${file.name.split(".").pop()}`;
      await supabase.storage.from("brand-assets").upload(path, file, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from("brand-assets").getPublicUrl(path);
      setLogoUrl(publicUrl);

      // Auto-extract colors
      try {
        const { getPalette } = await import("color-thief-node");
        const buffer = Buffer.from(await file.arrayBuffer());
        const palette = getPalette(buffer, 2);
        if (palette[0]) setPrimaryColor(rgbToHex(palette[0]));
        if (palette[1]) setAccentColor(rgbToHex(palette[1]));
        toast.success("Brand colors extracted from logo");
      } catch {}
    } catch {
      toast.error("Logo upload failed");
    } finally {
      setUploadingLogo(false);
    }
  }, [supabase]);

  const onDropHeadshot = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploadingHeadshot(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const path = `brand/${user.id}/headshot.${file.name.split(".").pop()}`;
      await supabase.storage.from("brand-assets").upload(path, file, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from("brand-assets").getPublicUrl(path);
      setHeadshotUrl(publicUrl);
      toast.success("Headshot uploaded");
    } catch {
      toast.error("Headshot upload failed");
    } finally {
      setUploadingHeadshot(false);
    }
  }, [supabase]);

  const { getRootProps: getLogoRootProps, getInputProps: getLogoInputProps } = useDropzone({
    onDrop: onDropLogo, accept: { "image/*": [] }, maxFiles: 1,
  });
  const { getRootProps: getHeadshotRootProps, getInputProps: getHeadshotInputProps } = useDropzone({
    onDrop: onDropHeadshot, accept: { "image/*": [] }, maxFiles: 1,
  });

  async function handleAnalyzeVoice() {
    if (voiceExamples.trim().length < 20) {
      toast.error("Please enter at least 20 characters of caption examples");
      return;
    }
    setAnalyzingVoice(true);
    try {
      const res = await fetch("/api/brand/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceExamples }),
      });
      if (!res.ok) {
        const { error } = await res.json() as { error?: string };
        throw new Error(error || "Analyze failed");
      }
      const { voiceProfile: saved } = await res.json() as { voiceProfile: string };
      setVoiceProfile(saved);
      toast.success("Voice profile saved!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to analyze voice");
    } finally {
      setAnalyzingVoice(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl, headshotUrl, primaryColor, accentColor, font,
          agentName, licenseNumber, brokerage, phone,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Brand kit saved");
    } catch {
      toast.error("Failed to save brand kit");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Brand Kit</h1>
          <p className="text-muted-foreground text-sm mt-1">Applied to all your videos automatically</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Left column: form */}
        <div className="col-span-2 space-y-6">
          {/* Agent info */}
          <Card>
            <CardHeader><CardTitle className="text-base">Agent Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Full Name</Label>
                  <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Jane Smith" />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(415) 555-0123" />
                </div>
                <div className="space-y-1">
                  <Label>Brokerage</Label>
                  <Input value={brokerage} onChange={(e) => setBrokerage(e.target.value)} placeholder="Coldwell Banker" />
                </div>
                <div className="space-y-1">
                  <Label>License #</Label>
                  <Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="DRE 01234567" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logo + Headshot */}
          <Card>
            <CardHeader><CardTitle className="text-base">Logo & Headshot</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div>
                <Label className="mb-2 block">Logo</Label>
                {logoUrl ? (
                  <div className="relative h-20 bg-muted rounded-lg overflow-hidden mb-2">
                    <Image src={logoUrl} alt="Logo" fill className="object-contain p-2" />
                  </div>
                ) : null}
                <div {...getLogoRootProps()} className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors">
                  <input {...getLogoInputProps()} />
                  {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (
                    <>
                      <Upload className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Upload logo</p>
                    </>
                  )}
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Headshot</Label>
                {headshotUrl ? (
                  <div className="relative h-20 w-20 rounded-full overflow-hidden mb-2 mx-auto">
                    <Image src={headshotUrl} alt="Headshot" fill className="object-cover" />
                  </div>
                ) : null}
                <div {...getHeadshotRootProps()} className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors">
                  <input {...getHeadshotInputProps()} />
                  {uploadingHeadshot ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (
                    <>
                      <Upload className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Upload headshot</p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Colors + Font */}
          <Card>
            <CardHeader><CardTitle className="text-base">Colors & Typography</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Primary Color</Label>
                  <div className="flex gap-2">
                    <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-12 rounded cursor-pointer" />
                    <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#1A2E4A" className="font-mono" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Accent Color</Label>
                  <div className="flex gap-2">
                    <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-10 w-12 rounded cursor-pointer" />
                    <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} placeholder="#F5A623" className="font-mono" />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Font</Label>
                <Select value={font} onValueChange={(v) => v && setFont(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOOGLE_FONTS.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Brand Voice */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Brand Voice (optional)</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Paste 3–5 of your best captions. Claude analyzes your writing style and matches future content.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={voiceExamples}
                onChange={(e) => setVoiceExamples(e.target.value)}
                placeholder="Paste examples of your captions here..."
                rows={6}
              />
              {voiceProfile && (
                <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-green-800">Voice profile active</p>
                    <p className="text-xs text-green-700 mt-0.5">
                      {voiceProfile.substring(0, 80)}{voiceProfile.length > 80 ? "…" : ""}
                    </p>
                  </div>
                </div>
              )}
              <Button
                variant="outline"
                onClick={handleAnalyzeVoice}
                disabled={analyzingVoice}
                className="w-full sm:w-auto"
              >
                {analyzingVoice ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Analyze &amp; Save Voice
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right column: live preview */}
        <div className="space-y-4">
          <Label>Lower-third Preview</Label>
          <div className="rounded-xl overflow-hidden border bg-black aspect-video relative">
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div
              className="absolute bottom-0 left-0 right-0 px-3 py-2"
              style={{ backgroundColor: `${primaryColor}cc` }}
            >
              <p
                className="text-white font-semibold text-xs truncate"
                style={{ fontFamily: font, color: "#ffffff" }}
              >
                {agentName || "Agent Name"}
              </p>
              <p
                className="text-xs truncate opacity-80"
                style={{ fontFamily: font, color: accentColor }}
              >
                {brokerage || "Brokerage Name"} · {phone || "Phone"}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            This lower-third appears on all your videos.
          </p>
          <Separator />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Logo used for watermark removal</p>
            <p>• Colors auto-extracted from logo</p>
            <p>• Applied to all future videos</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function rgbToHex([r, g, b]: number[]): string {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
