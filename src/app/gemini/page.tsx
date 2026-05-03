import { redirect } from "next/navigation";
import { Ban, KeyRound, Save } from "lucide-react";
import { saveGeminiKey } from "./actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { RelationalPicker } from "@/components/operator/relational-picker";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GEMINI_KEY_ROLES, GEMINI_MODELS } from "@/lib/gemini/validation";

export const dynamic = "force-dynamic";

function pickerOptions(values: readonly string[]) {
  return values.map((value) => ({
    value,
    label: value,
  }));
}

function fieldValue(value: string | number | null | undefined) {
  return value ?? "";
}

export default async function GeminiPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: geminiKeys, error } = await supabase
    .from("gemini_api_keys")
    .select(
      "id, key_code, label, provider, google_account_label, project_label, model_name, role, rpm_limit, rpd_limit, tpm_limit, status, notes, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    return (
      <SectionCard icon={KeyRound} title="Unable to load Gemini." description={error.message}>
        <EmptyState icon={KeyRound} title="Gemini unavailable." description="Try again." />
      </SectionCard>
    );
  }

  const geminiKey = geminiKeys?.[0] ?? null;
  const hasKey = Boolean(geminiKey);

  return (
    <div className="stack">
      <SectionCard
        icon={KeyRound}
        title={hasKey ? "Edit Gemini key" : "Create Gemini key"}
      >
        {geminiKey ? (
          <div className="section-card__actions">
            <StatusBadge status={geminiKey.status} />
            <StatusBadge status={geminiKey.role} tone="info" />
          </div>
        ) : null}

        <form className="stack" action={saveGeminiKey}>
          <input type="hidden" name="intent" value={hasKey ? "update" : "create"} />
          {geminiKey ? <input type="hidden" name="id" value={geminiKey.id} /> : null}
          {geminiKey ? <input type="hidden" name="key_code" value={geminiKey.key_code} /> : null}
          {geminiKey ? <input type="hidden" name="status" value={geminiKey.status} /> : null}
          {geminiKey ? <input type="hidden" name="google_account_label" value={fieldValue(geminiKey.google_account_label)} /> : null}
          {geminiKey ? <input type="hidden" name="project_label" value={fieldValue(geminiKey.project_label)} /> : null}
          {geminiKey ? <input type="hidden" name="rpm_limit" value={fieldValue(geminiKey.rpm_limit)} /> : null}
          {geminiKey ? <input type="hidden" name="rpd_limit" value={fieldValue(geminiKey.rpd_limit)} /> : null}
          {geminiKey ? <input type="hidden" name="tpm_limit" value={fieldValue(geminiKey.tpm_limit)} /> : null}
          {geminiKey ? <input type="hidden" name="notes" value={fieldValue(geminiKey.notes)} /> : null}
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="gemini-name">
              <span>Nama</span>
              <input
                id="gemini-name"
                name="name"
                type="text"
                defaultValue={fieldValue(geminiKey?.label)}
                placeholder="Primary Vision Key"
                required
              />
            </label>
            <RelationalPicker
              defaultValue={geminiKey?.model_name ?? GEMINI_MODELS[0]}
              label="Model"
              name="model"
              options={pickerOptions(GEMINI_MODELS)}
              placeholder="Pilih model"
              required
              searchable={false}
            />
          </div>
          <div className="grid two-up">
            <RelationalPicker
              defaultValue={geminiKey?.role ?? GEMINI_KEY_ROLES[0]}
              label="Purpose"
              name="purpose"
              options={pickerOptions(GEMINI_KEY_ROLES)}
              placeholder="Pilih purpose"
              required
              searchable={false}
            />
            <label className="stack auth-field" htmlFor="gemini-raw-api-key">
              <span>API Key</span>
              <input
                id="gemini-raw-api-key"
                name="raw_api_key"
                type="password"
                autoComplete="off"
                placeholder={hasKey ? "Leave blank to keep current key" : "Enter API key"}
                required={!hasKey}
              />
            </label>
          </div>
          <FormActions>
            <button className="button primary" type="submit">
              <Save size={16} aria-hidden="true" />
              Save Gemini key
            </button>
          </FormActions>
        </form>

        {geminiKey ? (
          <FormActions>
            <form action={saveGeminiKey}>
              <input type="hidden" name="intent" value="disable" />
              <input type="hidden" name="id" value={geminiKey.id} />
              <button className="button" type="submit">
                <Ban size={16} aria-hidden="true" />
                Disable key
              </button>
            </form>
          </FormActions>
        ) : null}
      </SectionCard>
    </div>
  );
}
