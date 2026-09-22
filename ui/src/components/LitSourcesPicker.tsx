import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { setScopedQueryData } from "../queries/client";
import { getLitSourcesQuery } from "../queries/settings";
import { m } from "../paraglide/messages.js";
// Literature-source toggles shown inline in the composer chat-settings panel:
// which sources discovery and paper reading may use. State lives in settings.json
// (same `/api/settings/lit-sources` endpoint the CLI enforces).

import { setLitSources, type LitSourcesSettings, type LitSourcesUpdate } from "../api";
import { LitSourceLogo, LIT_SOURCE_NAME, type LitSource } from "./LitSourceLogo";
import { MenuItem, SwitchIndicator } from "./ui";

const BUILTIN: LitSource[] = ["alphaxiv", "openalex", "biorxiv"];
const ADDED: LitSource[] = ["lacuna", "keenable", "asta", "scispace"];

const KEY_FIELD: Partial<Record<LitSource, "astaKey" | "keenableKey" | "scispaceKey">> = {
  asta: "astaKey",
  keenable: "keenableKey",
  scispace: "scispaceKey",
};

const KEY_SET: Partial<Record<LitSource, keyof LitSourcesSettings>> = {
  asta: "astaKeySet",
  keenable: "keenableKeySet",
  scispace: "scispaceKeySet",
};

function toggles(settings: LitSourcesSettings, key: LitSource, on: boolean): LitSourcesUpdate {
  return {
    alphaxiv: settings.alphaxiv,
    openalex: settings.openalex,
    biorxiv: settings.biorxiv,
    lacuna: settings.lacuna,
    keenable: settings.keenable,
    asta: settings.asta,
    scispace: settings.scispace,
    astaKeySet: settings.astaKeySet,
    keenableKeySet: settings.keenableKeySet,
    scispaceKeySet: settings.scispaceKeySet,
    [key]: on,
  };
}

export function LitSourcesList() {
  const options = getLitSourcesQuery();
  const { data: settings } = useQuery(options);
  const mutation = useMutation({
    mutationFn: setLitSources,
    onSuccess: (settings) => setScopedQueryData(options.queryKey, settings),
  });
  const [keyDraft, setKeyDraft] = useState<Partial<Record<LitSource, string>>>({});
  const [keyOpen, setKeyOpen] = useState<LitSource | null>(null);
  const saving = mutation.isPending;
  const toggle = (key: LitSource) => {
    if (settings && !saving) mutation.mutate(toggles(settings, key, !settings[key]));
  };
  const saveKey = (key: LitSource) => {
    if (!settings || saving) return;
    const field = KEY_FIELD[key];
    if (!field) return;
    mutation.mutate({ ...toggles(settings, key, settings[key]), [field]: keyDraft[key] ?? "" });
    setKeyOpen(null);
  };

  if (!settings) return <div className="py-1.5 px-2 text-muted text-sm">{m.lit_sources_picker_loading()}</div>;

  const group = (label: string, keys: LitSource[]) => (
    <div className="flex flex-col">
      <span className="px-2 pt-1.5 text-xs text-muted">{label}</span>
      {keys.map((key) => {
        const on = settings[key];
        const keyName = KEY_SET[key];
        const hasKey = keyName ? Boolean(settings[keyName]) : false;
        const subtitle = key === "asta" || key === "scispace"
          ? hasKey ? m.lit_sources_key_saved() : m.lit_sources_key_required()
          : key === "keenable"
            ? hasKey ? m.lit_sources_key_saved() : m.lit_sources_key_optional()
            : sourceHint(key);
        return (
          <div key={key}>
            <MenuItem
              type="button"
              role="switch"
              aria-checked={on}
              disabled={saving}
              onClick={() => toggle(key)}
            >
              <span className="flex min-w-0 flex-col">
                <span className="inline-flex items-center gap-[9px]">
                  <LitSourceLogo source={key} size={16} decorative />
                  {LIT_SOURCE_NAME[key]}
                </span>
                <span className="model-id">{subtitle}</span>
              </span>
              <SwitchIndicator checked={on} aria-hidden="true" />
            </MenuItem>
            {KEY_FIELD[key] && (
              keyOpen === key ? (
                <form
                  className="flex items-center gap-1 px-2 pb-1"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveKey(key);
                  }}
                >
                  <input
                    className="min-w-0 flex-1 rounded-sm border border-border bg-background px-2 py-1 text-sm text-text"
                    type="password"
                    autoComplete="off"
                    aria-label={m.lit_sources_add_key()}
                    placeholder={m.lit_sources_key_placeholder()}
                    value={keyDraft[key] ?? ""}
                    onChange={(event) => setKeyDraft((draft) => ({ ...draft, [key]: event.target.value }))}
                  />
                  <button type="submit" className="text-sm text-subtext" disabled={saving}>
                    {m.lit_sources_save_key()}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="px-2 pb-1 text-start text-xs text-subtext"
                  onClick={() => setKeyOpen(key)}
                >
                  {hasKey ? m.lit_sources_replace_key() : m.lit_sources_add_key()}
                </button>
              )
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col">
      {group(m.lit_sources_group_builtin(), BUILTIN)}
      {group(m.lit_sources_group_more(), ADDED)}
    </div>
  );
}

function sourceHint(key: LitSource): string {
  switch (key) {
    case "alphaxiv":
      return m.lit_sources_hint_alphaxiv();
    case "openalex":
      return m.lit_sources_hint_openalex();
    case "biorxiv":
      return m.lit_sources_hint_biorxiv();
    case "lacuna":
      return m.lit_sources_hint_lacuna();
    default:
      return "";
  }
}
