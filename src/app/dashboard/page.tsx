"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────

interface UTMLink {
  id: string;
  channel: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  full_url: string;
  is_active: boolean;
  created_at: string;
}

interface Campaign {
  id: string;
  name: string;
  base_url: string;
  created_at: string;
  links: UTMLink[];
}

// ── Channel Defaults ───────────────────────────────────────────────────────

const CHANNELS: { name: string; utm_source: string; utm_medium: string }[] = [
  { name: "Facebook", utm_source: "facebook", utm_medium: "social" },
  { name: "Instagram", utm_source: "instagram", utm_medium: "social" },
  { name: "X / Twitter", utm_source: "twitter", utm_medium: "social" },
  { name: "LinkedIn", utm_source: "linkedin", utm_medium: "social" },
  { name: "Google Ads", utm_source: "google", utm_medium: "cpc" },
  { name: "Email", utm_source: "email", utm_medium: "email" },
  { name: "TikTok", utm_source: "tiktok", utm_medium: "social" },
  { name: "YouTube", utm_source: "youtube", utm_medium: "video" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[\s-]+/g, "_");
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function buildFullUrl(
  baseUrl: string,
  params: {
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    utm_term?: string;
    utm_content?: string;
  }
): string {
  const url = new URL(baseUrl);
  url.searchParams.set("utm_source", params.utm_source);
  url.searchParams.set("utm_medium", params.utm_medium);
  url.searchParams.set("utm_campaign", params.utm_campaign);
  if (params.utm_term) url.searchParams.set("utm_term", params.utm_term);
  if (params.utm_content) url.searchParams.set("utm_content", params.utm_content);
  return url.toString();
}

// ── Toast Component ────────────────────────────────────────────────────────

function Toast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-[slideUp_0.2s_ease-out] bg-gray-900 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium">
      {message}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();

  // State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCampaigns, setCollapsedCampaigns] = useState<Set<string>>(
    new Set()
  );

  // Form state
  const [baseUrl, setBaseUrl] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(
    new Set()
  );
  const [channelOverrides, setChannelOverrides] = useState<
    Record<string, { source?: string; medium?: string; term?: string; content?: string }>
  >({});
  const [urlTouched, setUrlTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);

  // Edit state
  const [editingLink, setEditingLink] = useState<{
    campaignId: string;
    linkId: string;
  } | null>(null);
  const [editForm, setEditForm] = useState({
    utm_source: "",
    utm_medium: "",
    utm_term: "",
    utm_content: "",
  });

  // Link Shortener state
  const [shortenUrl, setShortenUrl] = useState("");
  const [shortenBrand, setShortenBrand] = useState("");
  const [isShorteningLoading, setIsShorteningLoading] = useState(false);
  const [shortenedLinks, setShortenedLinks] = useState<
    { id: string; original_url: string; short_url: string; short_code: string; brand: string; created_at: string }[]
  >([]);

  // Ref for advanced options
  const [showAdvanced, setShowAdvanced] = useState<string | null>(null);

  // ── Load from localStorage ─────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem("utm_campaigns");
      if (saved) setCampaigns(JSON.parse(saved));
      const savedBrand = localStorage.getItem("utm_brand");
      if (savedBrand) setShortenBrand(savedBrand);
      const savedShortened = localStorage.getItem("utm_shortened_links");
      if (savedShortened) setShortenedLinks(JSON.parse(savedShortened));
    } catch {}
    setLoaded(true);
  }, []);

  // ── Save to localStorage ──────────────────────────────────────────────
  useEffect(() => {
    if (loaded) {
      localStorage.setItem("utm_campaigns", JSON.stringify(campaigns));
    }
  }, [campaigns, loaded]);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem("utm_shortened_links", JSON.stringify(shortenedLinks));
    }
  }, [shortenedLinks, loaded]);

  // ── Toast helper ──────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => setToast(msg), []);

  // ── Form validation ───────────────────────────────────────────────────
  const urlError = urlTouched && baseUrl && !isValidUrl(baseUrl);
  const nameError = nameTouched && !campaignName.trim();
  const canGenerate =
    isValidUrl(baseUrl) &&
    campaignName.trim() &&
    selectedChannels.size > 0;

  // ── Channel toggle ────────────────────────────────────────────────────
  function toggleChannel(name: string) {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
        // Also close advanced if open
        if (showAdvanced === name) setShowAdvanced(null);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  // ── Override helpers ──────────────────────────────────────────────────
  function setOverride(
    channel: string,
    field: "source" | "medium" | "term" | "content",
    value: string
  ) {
    setChannelOverrides((prev) => ({
      ...prev,
      [channel]: { ...prev[channel], [field]: value },
    }));
  }

  // ── Generate links ────────────────────────────────────────────────────
  function handleGenerate() {
    if (!canGenerate) return;

    const slug = slugify(campaignName);
    const newCampaign: Campaign = {
      id: generateId(),
      name: campaignName.trim(),
      base_url: baseUrl.trim(),
      created_at: new Date().toISOString(),
      links: [],
    };

    for (const channelName of selectedChannels) {
      const defaults = CHANNELS.find((c) => c.name === channelName)!;
      const overrides = channelOverrides[channelName] || {};
      const source = overrides.source?.trim() || defaults.utm_source;
      const medium = overrides.medium?.trim() || defaults.utm_medium;
      const term = overrides.term?.trim() || "";
      const content = overrides.content?.trim() || "";

      newCampaign.links.push({
        id: generateId(),
        channel: channelName,
        utm_source: source,
        utm_medium: medium,
        utm_campaign: slug,
        utm_term: term,
        utm_content: content,
        full_url: buildFullUrl(baseUrl.trim(), {
          utm_source: source,
          utm_medium: medium,
          utm_campaign: slug,
          utm_term: term,
          utm_content: content,
        }),
        is_active: true,
        created_at: new Date().toISOString(),
      });
    }

    setCampaigns((prev) => [newCampaign, ...prev]);

    // Reset form
    setBaseUrl("");
    setCampaignName("");
    setSelectedChannels(new Set());
    setChannelOverrides({});
    setUrlTouched(false);
    setNameTouched(false);
    setShowAdvanced(null);

    showToast(`Campaign "${campaignName.trim()}" created with ${newCampaign.links.length} link(s)`);
  }

  // ── Link actions ──────────────────────────────────────────────────────
  function toggleLink(campaignId: string, linkId: string) {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === campaignId
          ? {
              ...c,
              links: c.links.map((l) =>
                l.id === linkId ? { ...l, is_active: !l.is_active } : l
              ),
            }
          : c
      )
    );
  }

  function deleteLink(campaignId: string, linkId: string) {
    setCampaigns((prev) =>
      prev
        .map((c) =>
          c.id === campaignId
            ? { ...c, links: c.links.filter((l) => l.id !== linkId) }
            : c
        )
        .filter((c) => c.links.length > 0)
    );
    showToast("Link deleted");
  }

  function deleteCampaign(campaignId: string) {
    setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    showToast("Campaign deleted");
  }

  function bulkToggle(campaignId: string, active: boolean) {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === campaignId
          ? { ...c, links: c.links.map((l) => ({ ...l, is_active: active })) }
          : c
      )
    );
    showToast(active ? "All links activated" : "All links deactivated");
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard");
  }

  function copyAllActive(campaign: Campaign) {
    const activeLinks = campaign.links
      .filter((l) => l.is_active)
      .map((l) => l.full_url)
      .join("\n");
    if (!activeLinks) {
      showToast("No active links to copy");
      return;
    }
    navigator.clipboard.writeText(activeLinks);
    showToast(
      `Copied ${campaign.links.filter((l) => l.is_active).length} active link(s)`
    );
  }

  function startEdit(campaignId: string, link: UTMLink) {
    setEditingLink({ campaignId, linkId: link.id });
    setEditForm({
      utm_source: link.utm_source,
      utm_medium: link.utm_medium,
      utm_term: link.utm_term,
      utm_content: link.utm_content,
    });
  }

  function saveEdit() {
    if (!editingLink) return;
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === editingLink.campaignId
          ? {
              ...c,
              links: c.links.map((l) => {
                if (l.id !== editingLink.linkId) return l;
                const source = editForm.utm_source.trim() || l.utm_source;
                const medium = editForm.utm_medium.trim() || l.utm_medium;
                const term = editForm.utm_term.trim();
                const content = editForm.utm_content.trim();
                return {
                  ...l,
                  utm_source: source,
                  utm_medium: medium,
                  utm_term: term,
                  utm_content: content,
                  full_url: buildFullUrl(c.base_url, {
                    utm_source: source,
                    utm_medium: medium,
                    utm_campaign: l.utm_campaign,
                    utm_term: term,
                    utm_content: content,
                  }),
                };
              }),
            }
          : c
      )
    );
    setEditingLink(null);
    showToast("Link updated");
  }

  // ── Shorten link (standalone) ─────────────────────────────────────────
  async function handleShortenLink() {
    const url = shortenUrl.trim();
    const brand = shortenBrand.trim();

    if (!url || !isValidUrl(url)) return;

    // Save brand for future use
    if (brand) {
      localStorage.setItem("utm_brand", brand);
    }

    setIsShorteningLoading(true);
    try {
      const res = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, full_url: url }),
      });

      if (!res.ok) throw new Error("API error");

      const data = await res.json();

      setShortenedLinks((prev) => [
        {
          id: data.short_code,
          original_url: url,
          short_url: data.short_url,
          short_code: data.short_code,
          brand,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setShortenUrl("");
      showToast("Short link created!");
    } catch {
      showToast("Failed to create short link — try again");
    } finally {
      setIsShorteningLoading(false);
    }
  }

  function deleteShortenedLink(id: string) {
    setShortenedLinks((prev) => prev.filter((l) => l.id !== id));
    showToast("Shortened link removed");
  }

  // ── Collapse toggle ───────────────────────────────────────────────────
  function toggleCollapse(campaignId: string) {
    setCollapsedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
  }

  // ── Filtered campaigns ────────────────────────────────────────────────
  const filteredCampaigns = campaigns
    .map((c) => {
      if (!searchQuery.trim()) return c;
      const q = searchQuery.toLowerCase();
      if (c.name.toLowerCase().includes(q)) return c;
      const matchingLinks = c.links.filter(
        (l) =>
          l.channel.toLowerCase().includes(q) ||
          l.utm_source.toLowerCase().includes(q)
      );
      if (matchingLinks.length > 0) return { ...c, links: matchingLinks };
      return null;
    })
    .filter(Boolean) as Campaign[];

  // ── Don't render until loaded from localStorage ───────────────────────
  if (!loaded) return null;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  UTM Link Builder
                </h1>
                <p className="text-sm text-gray-500">
                  Generate and manage UTM-tagged campaign URLs
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.push("/login");
              }}
              className="px-3.5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ── Creation Form ─────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              Create Campaign Links
            </h2>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Base URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Base URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                onBlur={() => setUrlTouched(true)}
                placeholder="https://example.com/landing"
                className={`w-full px-3.5 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                  urlError
                    ? "border-red-300 bg-red-50"
                    : "border-gray-300 bg-white"
                }`}
              />
              {urlError && (
                <p className="mt-1 text-sm text-red-600">
                  Please enter a valid URL (e.g., https://example.com)
                </p>
              )}
            </div>

            {/* Campaign Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Campaign Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                onBlur={() => setNameTouched(true)}
                placeholder="Spring Sale 2026"
                className={`w-full px-3.5 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                  nameError
                    ? "border-red-300 bg-red-50"
                    : "border-gray-300 bg-white"
                }`}
              />
              {nameError && (
                <p className="mt-1 text-sm text-red-600">
                  Campaign name is required
                </p>
              )}
              {campaignName.trim() && (
                <p className="mt-1 text-xs text-gray-400">
                  utm_campaign={slugify(campaignName)}
                </p>
              )}
            </div>

            {/* Channel Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Channels <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CHANNELS.map((ch) => {
                  const selected = selectedChannels.has(ch.name);
                  return (
                    <div key={ch.name}>
                      <button
                        type="button"
                        onClick={() => toggleChannel(ch.name)}
                        className={`w-full px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                          selected
                            ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              selected
                                ? "bg-indigo-600 border-indigo-600"
                                : "border-gray-300"
                            }`}
                          >
                            {selected && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                          {ch.name}
                        </div>
                      </button>

                      {/* Advanced options per channel */}
                      {selected && (
                        <button
                          type="button"
                          onClick={() =>
                            setShowAdvanced(
                              showAdvanced === ch.name ? null : ch.name
                            )
                          }
                          className="mt-1 text-xs text-indigo-500 hover:text-indigo-700 pl-1"
                        >
                          {showAdvanced === ch.name
                            ? "Hide options"
                            : "Customize"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Channel Override Panel */}
              {showAdvanced && selectedChannels.has(showAdvanced) && (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Customize: {showAdvanced}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        utm_source
                      </label>
                      <input
                        type="text"
                        value={channelOverrides[showAdvanced]?.source ?? ""}
                        onChange={(e) =>
                          setOverride(showAdvanced!, "source", e.target.value)
                        }
                        placeholder={
                          CHANNELS.find((c) => c.name === showAdvanced)
                            ?.utm_source
                        }
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        utm_medium
                      </label>
                      <input
                        type="text"
                        value={channelOverrides[showAdvanced]?.medium ?? ""}
                        onChange={(e) =>
                          setOverride(showAdvanced!, "medium", e.target.value)
                        }
                        placeholder={
                          CHANNELS.find((c) => c.name === showAdvanced)
                            ?.utm_medium
                        }
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        utm_term
                      </label>
                      <input
                        type="text"
                        value={channelOverrides[showAdvanced]?.term ?? ""}
                        onChange={(e) =>
                          setOverride(showAdvanced!, "term", e.target.value)
                        }
                        placeholder="Optional"
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        utm_content
                      </label>
                      <input
                        type="text"
                        value={channelOverrides[showAdvanced]?.content ?? ""}
                        onChange={(e) =>
                          setOverride(showAdvanced!, "content", e.target.value)
                        }
                        placeholder="Optional"
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={`w-full py-3 rounded-lg text-sm font-semibold transition-all ${
                canGenerate
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              Generate{" "}
              {selectedChannels.size > 0
                ? `${selectedChannels.size} Link${selectedChannels.size > 1 ? "s" : ""}`
                : "Links"}
            </button>
          </div>
        </section>

        {/* ── Campaign URL List ─────────────────────────────────────── */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Campaign Links
            </h2>
            {campaigns.length > 0 && (
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search campaigns or channels..."
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          {filteredCampaigns.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-indigo-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                {campaigns.length > 0
                  ? "No matching campaigns"
                  : "No campaigns yet"}
              </h3>
              <p className="text-sm text-gray-500">
                {campaigns.length > 0
                  ? "Try adjusting your search terms"
                  : "Create your first campaign above to get started"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCampaigns.map((campaign) => {
                const isCollapsed = collapsedCampaigns.has(campaign.id);
                const activeCount = campaign.links.filter(
                  (l) => l.is_active
                ).length;

                return (
                  <div
                    key={campaign.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                  >
                    {/* Campaign Header */}
                    <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                      <button
                        onClick={() => toggleCollapse(campaign.id)}
                        className="flex items-center gap-3 text-left flex-1 min-w-0"
                      >
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${
                            isCollapsed ? "" : "rotate-90"
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {campaign.name}
                          </h3>
                          <p className="text-xs text-gray-400 truncate">
                            {campaign.base_url}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <span className="text-xs text-gray-400">
                          {activeCount}/{campaign.links.length} active
                        </span>
                        <button
                          onClick={() => bulkToggle(campaign.id, true)}
                          className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 transition-colors"
                        >
                          All On
                        </button>
                        <button
                          onClick={() => bulkToggle(campaign.id, false)}
                          className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                        >
                          All Off
                        </button>
                        <button
                          onClick={() => copyAllActive(campaign)}
                          className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
                        >
                          Copy Active
                        </button>
                        <button
                          onClick={() => deleteCampaign(campaign.id)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete campaign"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Links */}
                    {!isCollapsed && (
                      <div className="divide-y divide-gray-50">
                        {campaign.links.map((link) => {
                          const isEditing =
                            editingLink?.campaignId === campaign.id &&
                            editingLink?.linkId === link.id;

                          return (
                            <div
                              key={link.id}
                              className={`px-5 py-3 flex items-start gap-3 transition-opacity ${
                                link.is_active ? "" : "opacity-50"
                              }`}
                            >
                              {/* Toggle */}
                              <button
                                onClick={() =>
                                  toggleLink(campaign.id, link.id)
                                }
                                className={`mt-0.5 relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                                  link.is_active
                                    ? "bg-indigo-600"
                                    : "bg-gray-300"
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                    link.is_active
                                      ? "translate-x-4"
                                      : "translate-x-0"
                                  }`}
                                />
                              </button>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                {isEditing ? (
                                  // Edit form
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-0.5">
                                          Source
                                        </label>
                                        <input
                                          value={editForm.utm_source}
                                          onChange={(e) =>
                                            setEditForm((f) => ({
                                              ...f,
                                              utm_source: e.target.value,
                                            }))
                                          }
                                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-0.5">
                                          Medium
                                        </label>
                                        <input
                                          value={editForm.utm_medium}
                                          onChange={(e) =>
                                            setEditForm((f) => ({
                                              ...f,
                                              utm_medium: e.target.value,
                                            }))
                                          }
                                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-0.5">
                                          Term
                                        </label>
                                        <input
                                          value={editForm.utm_term}
                                          onChange={(e) =>
                                            setEditForm((f) => ({
                                              ...f,
                                              utm_term: e.target.value,
                                            }))
                                          }
                                          placeholder="Optional"
                                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-0.5">
                                          Content
                                        </label>
                                        <input
                                          value={editForm.utm_content}
                                          onChange={(e) =>
                                            setEditForm((f) => ({
                                              ...f,
                                              utm_content: e.target.value,
                                            }))
                                          }
                                          placeholder="Optional"
                                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={saveEdit}
                                        className="px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => setEditingLink(null)}
                                        className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  // Display
                                  <>
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                        {link.channel}
                                      </span>
                                      <span className="text-xs text-gray-400">
                                        {link.utm_source} / {link.utm_medium}
                                      </span>
                                    </div>

                                    {/* Full URL */}
                                    <p
                                      className={`text-sm break-all font-mono ${
                                        link.is_active
                                          ? "text-gray-700"
                                          : "text-gray-700 line-through"
                                      }`}
                                    >
                                      {link.full_url}
                                    </p>
                                  </>
                                )}
                              </div>

                              {/* Actions */}
                              {!isEditing && (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={() =>
                                      copyToClipboard(link.full_url)
                                    }
                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                    title="Copy link"
                                  >
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                      />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() =>
                                      startEdit(campaign.id, link)
                                    }
                                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                    title="Edit link"
                                  >
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                      />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() =>
                                      deleteLink(campaign.id, link.id)
                                    }
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                    title="Delete link"
                                  >
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Link Shortener ──────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900">Link Shortener</h2>
            </div>
            <p className="text-sm text-gray-500 mt-1">Shorten any URL with your brand name</p>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Brand Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Brand Name
              </label>
              <input
                type="text"
                value={shortenBrand}
                onChange={(e) => setShortenBrand(e.target.value)}
                placeholder="e.g., acme"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                Used as a prefix in your shortened links
              </p>
            </div>

            {/* URL to shorten */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                URL to Shorten <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={shortenUrl}
                  onChange={(e) => setShortenUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && isValidUrl(shortenUrl.trim())) handleShortenLink();
                  }}
                  placeholder="https://example.com/your-long-url"
                  className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <button
                  onClick={handleShortenLink}
                  disabled={!isValidUrl(shortenUrl.trim()) || isShorteningLoading}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                    isValidUrl(shortenUrl.trim()) && !isShorteningLoading
                      ? "bg-green-600 text-white hover:bg-green-700 shadow-sm"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {isShorteningLoading ? "Shortening..." : "Shorten"}
                </button>
              </div>
            </div>
          </div>

          {/* Shortened Links List */}
          {shortenedLinks.length > 0 && (
            <div className="border-t border-gray-100">
              <div className="px-6 py-3 bg-gray-50">
                <h3 className="text-sm font-medium text-gray-700">
                  Your Shortened Links ({shortenedLinks.length})
                </h3>
              </div>
              <div className="divide-y divide-gray-50">
                {shortenedLinks.map((sl) => (
                  <div key={sl.id} className="px-6 py-3.5 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      {/* Short URL - prominent */}
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-mono font-semibold text-green-700 break-all">
                          {sl.short_url}
                        </p>
                        {sl.brand && (
                          <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded flex-shrink-0">
                            {sl.brand}
                          </span>
                        )}
                      </div>
                      {/* Original URL - muted */}
                      <p className="text-xs text-gray-400 font-mono break-all truncate">
                        {sl.original_url}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => copyToClipboard(sl.short_url)}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Copy short link"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteShortenedLink(sl.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Slide-up animation */}
      <style jsx global>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
