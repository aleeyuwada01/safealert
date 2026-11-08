import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Plus,
  Trash2,
  Send,
  ShieldCheck,
  AlertTriangle,
  Wand2,
  CheckSquare,
  Square,
  Search,
  Sparkles,
  Phone,
  History,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeTelcoCompliance,
  buildTelcoSafeAlertMessage,
  parseBulkPhoneNumbers,
  PREDEFINED_SMS_TEMPLATES,
} from "@/lib/telco-compliance";
import {
  getSmsDirectoryState,
  upsertSmsRecipients,
  toggleSmsRecipient,
  deleteSmsRecipient,
  dispatchSmartSmsCampaign,
} from "@/lib/sms-directory.functions";
import type { SmsCampaignRow, SmsRecipientRow } from "@/lib/sms-directory.server";
import type { BulkSmsEnvironment, BulkSmsGatewayRoute } from "@/lib/bulksms-nigeria";

const GROUP_TAGS = [
  "First Responders",
  "Health Workers",
  "Community Leaders",
  "Logistics & Transport",
  "Public",
];

const ZONE_CODES = ["ALL", "LAG-METRO", "FCT-ABJ", "KAN-NORTH", "RIV-DELTA"];

export function SmartSmsManager() {
  const [recipients, setRecipients] = useState<SmsRecipientRow[]>([]);
  const [campaigns, setCampaigns] = useState<SmsCampaignRow[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<
    Array<{
      id: string;
      headline: string;
      message: string;
      instructions: string | null;
      severity: string;
      hazard: string;
      status: string;
      issued_at: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  // Directory filters & selection
  const [searchQuery, setSearchQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Add / Bulk Import Contact Form
  const [rawNumbersInput, setRawNumbersInput] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactGroup, setContactGroup] = useState("First Responders");
  const [contactZone, setContactZone] = useState("LAG-METRO");
  const [contactNotes, setContactNotes] = useState("");
  const [savingContacts, setSavingContacts] = useState(false);

  // Smart Alert & Message Composer
  const [composerMode, setComposerMode] = useState<
    "single_alert" | "multi_alerts" | "predefined"
  >("single_alert");
  const [selectedSingleAlertId, setSelectedSingleAlertId] = useState<string>("");
  const [selectedMultiAlertIds, setSelectedMultiAlertIds] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    PREDEFINED_SMS_TEMPLATES[0]?.id ?? "ebola-surveillance",
  );
  const [campaignTitle, setCampaignTitle] = useState(
    "National Epidemic & Emergency SMS Broadcast",
  );
  const [messageBody, setMessageBody] = useState(
    PREDEFINED_SMS_TEMPLATES[0]?.body ?? "SAFEALERT ADVISORY: Monitor official bulletins.",
  );
  const [autoSanitize, setAutoSanitize] = useState(true);
  const [extraNumbers, setExtraNumbers] = useState("");

  // Gateway settings
  const [environment, setEnvironment] = useState<BulkSmsEnvironment>("sandbox");
  const [mode, setMode] = useState<"sms" | "voice">("sms");
  const [senderId, setSenderId] = useState("SafeAlert");
  const [gatewayRoute, setGatewayRoute] = useState<BulkSmsGatewayRoute>("direct-refund");
  const [apiToken, setApiToken] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [lastDispatchReport, setLastDispatchReport] = useState<Awaited<
    ReturnType<typeof dispatchSmartSmsCampaign>
  > | null>(null);

  async function loadDirectory() {
    setLoading(true);
    try {
      const state = await getSmsDirectoryState();
      setRecipients(state.recipients);
      setCampaigns(state.campaigns);
      setActiveAlerts(state.activeAlerts);
      if (state.recipients.length > 0 && selectedIds.length === 0) {
        setSelectedIds(state.recipients.filter((r) => r.is_active).map((r) => r.id));
      }
      const first = state.activeAlerts[0];
      if (first && !selectedSingleAlertId) {
        setSelectedSingleAlertId(first.id);
        setSelectedMultiAlertIds(state.activeAlerts.map((a) => a.id));
        setCampaignTitle(`Alert Push: ${first.headline.slice(0, 60)}`);
        setMessageBody(buildTelcoSafeAlertMessage([first]));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load SMS directory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDirectory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtered recipients
  const filteredRecipients = useMemo(() => {
    return recipients.filter((r) => {
      if (zoneFilter !== "ALL" && r.zone_code !== zoneFilter && r.zone_code !== "ALL") {
        return false;
      }
      if (groupFilter !== "ALL" && r.group_tag !== groupFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.phone_number.toLowerCase().includes(q) ||
          r.full_name.toLowerCase().includes(q) ||
          r.group_tag.toLowerCase().includes(q) ||
          r.zone_code.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [recipients, zoneFilter, groupFilter, searchQuery]);

  // Live preview of bulk-pasted numbers
  const parsedPreview = useMemo(
    () => parseBulkPhoneNumbers(rawNumbersInput),
    [rawNumbersInput],
  );

  // Live telco compliance analysis
  const compliance = useMemo(() => analyzeTelcoCompliance(messageBody), [messageBody]);

  function handleSelectSingleAlert(alertId: string) {
    setSelectedSingleAlertId(alertId);
    const found = activeAlerts.find((a) => a.id === alertId);
    if (found) {
      setCampaignTitle(`Alert Push: ${found.headline.slice(0, 60)}`);
      setMessageBody(buildTelcoSafeAlertMessage([found]));
    }
  }

  function handleToggleMultiAlert(alertId: string) {
    setSelectedMultiAlertIds((prev) => {
      const next = prev.includes(alertId)
        ? prev.filter((id) => id !== alertId)
        : [...prev, alertId];
      const chosen = activeAlerts.filter((a) => next.includes(a.id));
      if (chosen.length > 0) {
        const firstChosen = chosen[0];
        setCampaignTitle(
          chosen.length === 1 && firstChosen
            ? `Alert Push: ${firstChosen.headline.slice(0, 60)}`
            : `Multi-Alert Digest (${chosen.length} Active Alerts)`,
        );
        setMessageBody(buildTelcoSafeAlertMessage(chosen));
      }
      return next;
    });
  }

  function handleSelectAllAlerts() {
    const allIds = activeAlerts.map((a) => a.id);
    setSelectedMultiAlertIds(allIds);
    setCampaignTitle(`All Active Alerts Digest (${activeAlerts.length} Alerts)`);
    setMessageBody(buildTelcoSafeAlertMessage(activeAlerts));
  }

  function handleSelectTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    const tpl = PREDEFINED_SMS_TEMPLATES.find((t) => t.id === templateId);
    if (tpl) {
      setCampaignTitle(tpl.label);
      setMessageBody(tpl.body);
    }
  }

  async function handleSaveContacts(e: React.FormEvent) {
    e.preventDefault();
    if (!rawNumbersInput.trim()) return;
    setSavingContacts(true);
    try {
      const res = await upsertSmsRecipients({
        data: {
          rawNumbers: rawNumbersInput,
          fullName: contactName || null,
          groupTag: contactGroup,
          zoneCode: contactZone,
          notes: contactNotes || null,
        },
      });
      toast.success(`Saved ${res.addedCount} phone number(s) to the BulkSMS directory`);
      setRawNumbersInput("");
      setContactName("");
      setContactNotes("");
      await loadDirectory();
      // Select newly added
      setSelectedIds((prev) =>
        Array.from(new Set([...prev, ...res.recipients.map((r) => r.id)])),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save numbers");
    } finally {
      setSavingContacts(false);
    }
  }

  async function handleDispatchCampaign() {
    if (selectedIds.length === 0 && !extraNumbers.trim()) {
      toast.error("Select at least one saved recipient or enter an extra phone number.");
      return;
    }
    setDispatching(true);
    try {
      const res = await dispatchSmartSmsCampaign({
        data: {
          title: campaignTitle || "Emergency SMS Campaign",
          recipientIds: selectedIds,
          extraNumbers: extraNumbers || null,
          alertId:
            composerMode === "single_alert" && selectedSingleAlertId
              ? selectedSingleAlertId
              : null,
          messageBody,
          autoSanitize,
          senderId,
          gatewayRoute,
          environment,
          mode,
          apiToken: apiToken || null,
        },
      });
      setLastDispatchReport(res);
      if (autoSanitize && !compliance.isClean) {
        setMessageBody(res.finalBody);
      }
      toast.success(
        `Campaign dispatched to ${res.targetNumbers.length} recipient(s) [${res.dispatchResult.bsngCode}]`,
      );
      await loadDirectory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Campaign dispatch failed");
    } finally {
      setDispatching(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Summary Banner */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-mono text-[11px] font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Smart Recipient Directory · Alert Selector · Carrier DND Block-Word Shield
            </div>
            <h2 className="mt-2 font-display text-xl font-extrabold sm:text-2xl">
              Smart BulkSMS Directory &amp; Multi-Alert Broadcast Manager
            </h2>
            <p className="mt-1 max-w-3xl text-xs sm:text-sm text-muted-foreground">
              Save and organize citizen &amp; responder phone numbers by zone and group. Push a
              specific alert, selected alerts, all active alerts, or a predefined template with
              automatic Nigerian MNO block-word sanitization.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-border bg-surface px-3.5 py-2 text-center">
              <span className="block font-mono text-lg font-extrabold text-foreground">
                {recipients.length}
              </span>
              <span className="font-mono text-[10px] uppercase text-muted-foreground">
                Saved Numbers
              </span>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-center">
              <span className="block font-mono text-lg font-extrabold text-primary">
                {selectedIds.length}
              </span>
              <span className="font-mono text-[10px] uppercase text-primary">
                Selected to Push
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Layout: Left = Saved Directory + Add Numbers | Right = Smart Alert Composer + Telco Sanitizer */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN (7 cols): Add/Import Numbers + Saved Recipient Directory */}
        <div className="lg:col-span-6 space-y-6">
          {/* 1. Add Single or Bulk Numbers */}
          <form
            onSubmit={handleSaveContacts}
            className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-eyebrow">Step 1 · Save Phone Numbers</p>
                <h3 className="font-display text-base font-bold">
                  Add or Bulk-Paste Numbers to Directory
                </h3>
              </div>
              {parsedPreview.length > 0 && (
                <span className="rounded-full bg-success/15 px-2.5 py-1 font-mono text-[11px] font-bold text-success">
                  {parsedPreview.length} Valid MSISDN(s) Ready
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>
                Phone Number(s) — Single or Bulk Paste (comma, space, or newline separated)
              </Label>
              <Textarea
                rows={2}
                value={rawNumbersInput}
                onChange={(e) => setRawNumbersInput(e.target.value)}
                placeholder="e.g. 08031234567, 09050030090, +2347037770033"
                className="font-mono text-xs"
                required
              />
              {parsedPreview.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {parsedPreview.slice(0, 6).map((p) => (
                    <span
                      key={p.phone_number}
                      className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[10px]"
                    >
                      +{p.phone_number}{" "}
                      <strong className="text-primary">({p.network})</strong>
                    </span>
                  ))}
                  {parsedPreview.length > 6 && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      +{parsedPreview.length - 6} more
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Name / Label (Optional)</Label>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Lagos Red Cross"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Group Tag</Label>
                <select
                  value={contactGroup}
                  onChange={(e) => setContactGroup(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-surface px-2.5 text-xs text-foreground"
                >
                  {GROUP_TAGS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Coverage Zone</Label>
                <select
                  value={contactZone}
                  onChange={(e) => setContactZone(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs text-foreground"
                >
                  {ZONE_CODES.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button type="submit" size="sm" className="w-full rounded-xl" disabled={savingContacts}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {savingContacts
                ? "Saving to Directory…"
                : `Save ${parsedPreview.length || ""} Number(s) to Persistent Directory`}
            </Button>
          </form>

          {/* 2. Saved Directory Table with Smart Selection */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-eyebrow">Step 2 · Target Audience Selection</p>
                <h3 className="font-display text-base font-bold">
                  Saved Recipient Directory ({filteredRecipients.length} shown)
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() =>
                    setSelectedIds(
                      Array.from(
                        new Set([...selectedIds, ...filteredRecipients.map((r) => r.id)]),
                      ),
                    )
                  }
                >
                  <CheckSquare className="mr-1 h-3 w-3 text-primary" />
                  Select Filtered ({filteredRecipients.length})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() =>
                    setSelectedIds(recipients.filter((r) => r.is_active).map((r) => r.id))
                  }
                >
                  Select All Active
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setSelectedIds([])}
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name or 234..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="h-8 rounded-md border border-border bg-surface px-2.5 font-mono text-xs text-foreground"
              >
                <option value="ALL">All Zones</option>
                {ZONE_CODES.filter((z) => z !== "ALL").map((z) => (
                  <option key={z} value={z}>
                    Zone: {z}
                  </option>
                ))}
              </select>
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-foreground"
              >
                <option value="ALL">All Groups</option>
                {GROUP_TAGS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Recipient List */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-border rounded-xl border border-border">
              {loading ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Loading saved recipients…
                </div>
              ) : filteredRecipients.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No saved numbers match your filter. Add numbers above.
                </div>
              ) : (
                filteredRecipients.map((r) => {
                  const checked = selectedIds.includes(r.id);
                  return (
                    <div
                      key={r.id}
                      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs transition-colors ${
                        checked ? "bg-primary/6" : "hover:bg-surface/60"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedIds((prev) =>
                            prev.includes(r.id)
                              ? prev.filter((id) => id !== r.id)
                              : [...prev, r.id],
                          )
                        }
                        className="flex flex-1 items-center gap-2.5 text-left"
                      >
                        {checked ? (
                          <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono font-bold text-foreground">
                              +{r.phone_number}
                            </span>
                            <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                              {r.network}
                            </span>
                            <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                              {r.zone_code}
                            </span>
                            <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                              {r.group_tag}
                            </span>
                          </div>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {r.full_name} · Sent: {r.delivery_count}x
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            await toggleSmsRecipient({
                              data: { id: r.id, is_active: !r.is_active },
                            });
                            await loadDirectory();
                          }}
                          className={`rounded px-2 py-0.5 font-mono text-[10px] ${
                            r.is_active
                              ? "bg-success/15 text-success"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {r.is_active ? "Active" : "Paused"}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteSmsRecipient({ data: { id: r.id } });
                            setSelectedIds((prev) => prev.filter((id) => id !== r.id));
                            await loadDirectory();
                            toast.success("Contact removed");
                          }}
                          className="rounded p-1 text-muted-foreground hover:text-destructive"
                          title="Delete number"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (6 cols): Smart Alert Selector + Editable Message + Telco Block-Word Shield */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
            <div>
              <p className="text-eyebrow">Step 3 · Choose Alert or Predefined Message</p>
              <h3 className="font-display text-base font-bold">
                Smart Alert Push &amp; Telco-Safe Message Editor
              </h3>
            </div>

            {/* Source Mode Selector */}
            <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-border bg-surface p-1">
              <button
                type="button"
                onClick={() => {
                  setComposerMode("single_alert");
                  if (selectedSingleAlertId) handleSelectSingleAlert(selectedSingleAlertId);
                }}
                className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition-all ${
                  composerMode === "single_alert"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Specific Alert
              </button>
              <button
                type="button"
                onClick={() => {
                  setComposerMode("multi_alerts");
                  const chosen = activeAlerts.filter((a) =>
                    selectedMultiAlertIds.includes(a.id),
                  );
                  if (chosen.length > 0) {
                    setMessageBody(buildTelcoSafeAlertMessage(chosen));
                  }
                }}
                className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition-all ${
                  composerMode === "multi_alerts"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Selected / All Alerts
              </button>
              <button
                type="button"
                onClick={() => {
                  setComposerMode("predefined");
                  handleSelectTemplate(selectedTemplateId);
                }}
                className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition-all ${
                  composerMode === "predefined"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Predefined Template
              </button>
            </div>

            {/* Mode 1: Specific Alert Picker */}
            {composerMode === "single_alert" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Select Active Alert to Push</Label>
                <select
                  value={selectedSingleAlertId}
                  onChange={(e) => handleSelectSingleAlert(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground"
                >
                  {activeAlerts.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.severity.toUpperCase()} · {a.hazard.toUpperCase()}] {a.headline}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Mode 2: Multiple or All Active Alerts Picker */}
            {composerMode === "multi_alerts" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">
                    Check Alerts to Combine ({selectedMultiAlertIds.length} of{" "}
                    {activeAlerts.length} selected)
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    onClick={handleSelectAllAlerts}
                  >
                    Select All {activeAlerts.length} Active Alerts
                  </Button>
                </div>
                <div className="max-h-36 overflow-y-auto divide-y divide-border rounded-xl border border-border bg-surface/50">
                  {activeAlerts.map((a) => {
                    const checked = selectedMultiAlertIds.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handleToggleMultiAlert(a.id)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-surface"
                      >
                        {checked ? (
                          <CheckSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
                        ) : (
                          <Square className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate font-medium text-foreground">
                          <strong className="font-mono uppercase text-primary">
                            [{a.severity}]
                          </strong>{" "}
                          {a.headline}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mode 3: Predefined Emergency Templates */}
            {composerMode === "predefined" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Select Predefined MNO-Approved Template</Label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground"
                >
                  {PREDEFINED_SMS_TEMPLATES.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.label} (Zone: {tpl.zone_code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Editable Message Body + Real-Time Telco Block-Word Analyzer */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs">
                  Editable Broadcast Message (Customize freely before sending)
                </Label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setMessageBody(
                        "URGENT!!! Click here bit.ly/alert for FREE ₦50,000 cash prize & enter your BVN or OTP to WIN now!",
                      )
                    }
                    className="rounded border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                    title="Test how the Telco Block-Word Sanitizer catches restricted carrier words"
                  >
                    <Sparkles className="mr-1 inline h-3 w-3 text-accent" />
                    Demo Carrier Block-Words
                  </button>
                  {!compliance.isClean && (
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      className="h-6 px-2.5 text-[11px]"
                      onClick={() => {
                        setMessageBody(compliance.sanitizedText);
                        toast.success(
                          "Removed all carrier block-words and normalized to GSM-7",
                        );
                      }}
                    >
                      <Wand2 className="mr-1 h-3 w-3" />
                      1-Click Auto-Sanitize
                    </Button>
                  )}
                </div>
              </div>

              <Textarea
                rows={4}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                className="font-mono text-xs leading-relaxed"
              />

              {/* Live Telco Compliance Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 font-mono text-[11px]">
                <div className="flex items-center gap-2">
                  {compliance.isClean ? (
                    <span className="inline-flex items-center gap-1 font-bold text-success">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Telco DND &amp; Firewall Compliant (0 Block Words)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {compliance.violations.length} Carrier Block-Word(s) Detected
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>{compliance.encoding}</span>
                  <span>
                    {compliance.charCount} chars · {compliance.pageCount} page(s)
                  </span>
                </div>
              </div>

              {/* Detailed Violation Breakdown if any restricted word is typed */}
              {!compliance.isClean && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-destructive">
                      MNO Spam / DND Filter Triggers Found:
                    </span>
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                      <input
                        type="checkbox"
                        checked={autoSanitize}
                        onChange={(e) => setAutoSanitize(e.target.checked)}
                      />
                      Auto-Sanitize on Send
                    </label>
                  </div>
                  <ul className="space-y-1 font-mono text-[11px]">
                    {compliance.violations.map((v, i) => (
                      <li key={i} className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-destructive/20 px-1.5 py-0.5 font-bold text-destructive">
                          &ldquo;{v.matched}&rdquo;
                        </span>
                        <span className="text-muted-foreground">→ {v.reason} →</span>
                        <span className="rounded bg-success/20 px-1.5 py-0.5 font-bold text-success">
                          Replaced with &ldquo;{v.replacement}&rdquo;
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Gateway Route & Environment */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Environment</Label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as BulkSmsEnvironment)}
                  className="h-9 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs text-foreground"
                >
                  <option value="sandbox">Sandbox (Zero Cost)</option>
                  <option value="production">Production (/api/v2)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Gateway Route</Label>
                <select
                  value={gatewayRoute}
                  onChange={(e) => setGatewayRoute(e.target.value as BulkSmsGatewayRoute)}
                  className="h-9 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs text-foreground"
                >
                  <option value="direct-refund">direct-refund (Default)</option>
                  <option value="direct-corporate">direct-corporate (DND Bypass)</option>
                  <option value="corporate">corporate</option>
                  <option value="otp">otp (Priority)</option>
                  <option value="international">international</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Delivery Mode &amp; Sender ID</Label>
                <div className="flex gap-1.5">
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as "sms" | "voice")}
                    className="h-9 rounded-md border border-border bg-surface px-2 text-xs text-foreground"
                  >
                    <option value="sms">SMS</option>
                    <option value="voice">Voice Call</option>
                  </select>
                  <Input
                    value={senderId}
                    onChange={(e) => setSenderId(e.target.value.slice(0, 11))}
                    maxLength={11}
                    className="h-9 font-mono text-xs"
                    placeholder="SafeAlert"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Additional Ad-Hoc Numbers (Optional)</Label>
                <Input
                  value={extraNumbers}
                  onChange={(e) => setExtraNumbers(e.target.value)}
                  placeholder="0803..., 234905..."
                  className="h-9 font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">BulkSMS Nigeria API Token (Optional Override)</Label>
                <Input
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Uses BULKSMS_NIGERIA_API_TOKEN if blank"
                  className="h-9 font-mono text-xs"
                />
              </div>
            </div>

            <Button
              type="button"
              size="lg"
              onClick={handleDispatchCampaign}
              disabled={dispatching}
              className="w-full rounded-xl font-bold"
            >
              <Send className="mr-2 h-4 w-4" />
              {dispatching
                ? "Dispatching Telco-Safe Broadcast…"
                : `Push Alert to ${selectedIds.length} Selected Recipient(s)`}
            </Button>

            {lastDispatchReport && (
              <div className="rounded-xl border border-border bg-slate-950 p-3.5 font-mono text-xs text-slate-200">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-emerald-400">
                    {lastDispatchReport.dispatchResult.bsngCode} ·{" "}
                    {lastDispatchReport.targetNumbers.length} Recipient(s)
                  </span>
                  <span>{lastDispatchReport.dispatchResult.latencyMs}ms</span>
                </div>
                <p className="mt-2 text-[11px] text-slate-300">
                  Transmitted (Telco-Sanitized): &ldquo;{lastDispatchReport.finalBody}&rdquo;
                </p>
              </div>
            )}
          </div>

          {/* Recent Saved Broadcast Campaigns */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-bold">
                  Recent BulkSMS Campaigns ({campaigns.length})
                </h3>
              </div>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={loadDirectory}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-border rounded-xl border border-border">
              {campaigns.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  No campaigns sent yet. Push an alert above to log your first campaign.
                </p>
              ) : (
                campaigns.map((c) => (
                  <div key={c.id} className="px-3.5 py-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-foreground">{c.title}</span>
                      <span className="font-mono text-[10px] text-primary">
                        {c.recipients_count} numbers · {c.bsng_code || c.environment}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 font-mono text-[11px] text-muted-foreground">
                      {c.sanitized_body}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
