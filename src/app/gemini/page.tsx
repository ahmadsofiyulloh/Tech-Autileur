import { redirect } from "next/navigation";
import { Ban, KeyRound, Save } from "lucide-react";
import { saveGeminiKey } from "./actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACCOUNT_STATUSES, GEMINI_KEY_ROLES, GEMINI_MODELS } from "@/lib/gemini/validation";

export const dynamic = "force-dynamic";

function selectOptions(values: readonly string[]) {
  return values.map((value) => (
    <option key={value} value={value}>
      {value}
    </option>
  ));
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
      "id, key_code, label, provider, google_account_label, project_label, model_name, role, rpm_limit, rpd_limit, tpm_limit, requests_today, last_used_at, cooldown_until, status, notes, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <SectionCard icon={KeyRound} badge="Error" title="Unable to load Gemini." description={error.message}>
        <EmptyState
          icon={KeyRound}
          title="Gemini unavailable."
          description="Try again."
        />
      </SectionCard>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        icon={KeyRound}
        badge="Config"
        title="Gemini"
        description="Keys, roles, and limits."
        stats={[
          { label: "Keys", value: geminiKeys?.length ?? 0 },
          { label: "Target", value: "3 keys" },
          { label: "Secrets", value: <StatusBadge status="Private" tone="success" /> },
        ]}
      />

      <SectionCard
        icon={KeyRound}
        badge="New"
        title="Add key"
        description="Set role, model, and quota."
      >
        <form className="stack" action={saveGeminiKey}>
          <input type="hidden" name="intent" value="create" />
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-key-code">
              <span>Key Code</span>
              <input id="create-key-code" name="key_code" type="text" placeholder="PROD-001" required />
            </label>
            <label className="stack auth-field" htmlFor="create-label">
              <span>Label</span>
              <input id="create-label" name="label" type="text" placeholder="Primary Vision Key" required />
            </label>
          </div>
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-google-account-label">
              <span>Google Account Label</span>
              <input id="create-google-account-label" name="google_account_label" type="text" placeholder="owner@gmail.com" />
            </label>
            <label className="stack auth-field" htmlFor="create-project-label">
              <span>Project Label</span>
              <input id="create-project-label" name="project_label" type="text" placeholder="Studio Project 1" />
            </label>
          </div>
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-model-name">
              <span>Model Name</span>
              <select id="create-model-name" name="model_name" defaultValue={GEMINI_MODELS[0]} required>
                {selectOptions(GEMINI_MODELS)}
              </select>
            </label>
            <label className="stack auth-field" htmlFor="create-role">
              <span>Role</span>
              <select id="create-role" name="role" defaultValue={GEMINI_KEY_ROLES[0]} required>
                {selectOptions(GEMINI_KEY_ROLES)}
              </select>
            </label>
          </div>
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-rpm-limit">
              <span>RPM Limit</span>
              <input id="create-rpm-limit" name="rpm_limit" type="number" min="0" inputMode="numeric" />
            </label>
            <label className="stack auth-field" htmlFor="create-rpd-limit">
              <span>RPD Limit</span>
              <input id="create-rpd-limit" name="rpd_limit" type="number" min="0" inputMode="numeric" />
            </label>
          </div>
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-tpm-limit">
              <span>TPM Limit</span>
              <input id="create-tpm-limit" name="tpm_limit" type="number" min="0" inputMode="numeric" />
            </label>
            <label className="stack auth-field" htmlFor="create-status">
              <span>Status</span>
              <select id="create-status" name="status" defaultValue="ACTIVE" required>
                {selectOptions(ACCOUNT_STATUSES)}
              </select>
            </label>
          </div>
          <label className="stack auth-field" htmlFor="create-notes">
            <span>Notes</span>
            <textarea id="create-notes" name="notes" rows={3} placeholder="Optional notes" />
          </label>
          <label className="stack auth-field" htmlFor="create-raw-api-key">
            <span>Raw API Key</span>
            <input id="create-raw-api-key" name="raw_api_key" type="password" autoComplete="off" required />
          </label>
          <p className="subtle">
            Secret values are write-only.
          </p>
          <FormActions>
            <button className="button primary" type="submit">
              <Save size={16} aria-hidden="true" />
              Save Gemini key
            </button>
          </FormActions>
        </form>
      </SectionCard>

      {geminiKeys?.length ? (
        <section className="stack">
          {geminiKeys.map((key) => (
            <SectionCard
              badge={key.key_code}
              icon={KeyRound}
              title={key.label}
              description={key.project_label ?? key.google_account_label ?? "No project set."}
              key={key.id}
              actions={<StatusBadge status={key.status} />}
            >
              <div className="metric-grid">
                <div className="metric">
                  <span>Model</span>
                  <strong>{key.model_name}</strong>
                </div>
                <div className="metric">
                  <span>Role</span>
                  <strong>
                    <StatusBadge status={key.role} tone="info" />
                  </strong>
                </div>
                <div className="metric">
                  <span>Requests Today</span>
                  <strong>{key.requests_today}</strong>
                </div>
              </div>

              <form className="stack" action={saveGeminiKey}>
                <input type="hidden" name="intent" value="update" />
                <input type="hidden" name="id" value={key.id} />
                <div className="grid two-up">
                  <label className="stack auth-field" htmlFor={`key-code-${key.id}`}>
                    <span>Key Code</span>
                    <input id={`key-code-${key.id}`} name="key_code" type="text" defaultValue={key.key_code} required />
                  </label>
                  <label className="stack auth-field" htmlFor={`label-${key.id}`}>
                    <span>Label</span>
                    <input id={`label-${key.id}`} name="label" type="text" defaultValue={key.label} required />
                  </label>
                </div>
                <div className="grid two-up">
                  <label className="stack auth-field" htmlFor={`google-account-label-${key.id}`}>
                    <span>Google Account Label</span>
                    <input
                      id={`google-account-label-${key.id}`}
                      name="google_account_label"
                      type="text"
                      defaultValue={fieldValue(key.google_account_label)}
                    />
                  </label>
                  <label className="stack auth-field" htmlFor={`project-label-${key.id}`}>
                    <span>Project Label</span>
                    <input
                      id={`project-label-${key.id}`}
                      name="project_label"
                      type="text"
                      defaultValue={fieldValue(key.project_label)}
                    />
                  </label>
                </div>
                <div className="grid two-up">
                  <label className="stack auth-field" htmlFor={`model-name-${key.id}`}>
                    <span>Model Name</span>
                    <select id={`model-name-${key.id}`} name="model_name" defaultValue={key.model_name} required>
                      {selectOptions(GEMINI_MODELS)}
                    </select>
                  </label>
                  <label className="stack auth-field" htmlFor={`role-${key.id}`}>
                    <span>Role</span>
                    <select id={`role-${key.id}`} name="role" defaultValue={key.role} required>
                      {selectOptions(GEMINI_KEY_ROLES)}
                    </select>
                  </label>
                </div>
                <div className="grid two-up">
                  <label className="stack auth-field" htmlFor={`rpm-limit-${key.id}`}>
                    <span>RPM Limit</span>
                    <input
                      id={`rpm-limit-${key.id}`}
                      name="rpm_limit"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      defaultValue={fieldValue(key.rpm_limit)}
                    />
                  </label>
                  <label className="stack auth-field" htmlFor={`rpd-limit-${key.id}`}>
                    <span>RPD Limit</span>
                    <input
                      id={`rpd-limit-${key.id}`}
                      name="rpd_limit"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      defaultValue={fieldValue(key.rpd_limit)}
                    />
                  </label>
                </div>
                <div className="grid two-up">
                  <label className="stack auth-field" htmlFor={`tpm-limit-${key.id}`}>
                    <span>TPM Limit</span>
                    <input
                      id={`tpm-limit-${key.id}`}
                      name="tpm_limit"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      defaultValue={fieldValue(key.tpm_limit)}
                    />
                  </label>
                  <label className="stack auth-field" htmlFor={`status-${key.id}`}>
                    <span>Status</span>
                    <select id={`status-${key.id}`} name="status" defaultValue={key.status} required>
                      {selectOptions(ACCOUNT_STATUSES)}
                    </select>
                  </label>
                </div>
                <label className="stack auth-field" htmlFor={`notes-${key.id}`}>
                  <span>Notes</span>
                  <textarea id={`notes-${key.id}`} name="notes" rows={3} defaultValue={fieldValue(key.notes)} />
                </label>
                <label className="stack auth-field" htmlFor={`raw-api-key-${key.id}`}>
                  <span>Raw API Key</span>
                  <input
                    id={`raw-api-key-${key.id}`}
                    name="raw_api_key"
                    type="password"
                    autoComplete="off"
                    placeholder="Leave blank to keep existing secret"
                  />
                </label>
                <p className="subtle">
                  Leave blank to keep the current secret.
                </p>
                <FormActions>
                  <button className="button primary" type="submit">
                    <Save size={16} aria-hidden="true" />
                    Save changes
                  </button>
                </FormActions>
              </form>

              <FormActions>
                <form action={saveGeminiKey}>
                  <input type="hidden" name="intent" value="disable" />
                  <input type="hidden" name="id" value={key.id} />
                  <button className="button" type="submit">
                    <Ban size={16} aria-hidden="true" />
                    Disable key
                  </button>
                </form>
              </FormActions>
            </SectionCard>
          ))}
        </section>
      ) : (
        <EmptyState
          icon={KeyRound}
          title="No Gemini keys yet."
          description="Add a key to start."
        />
      )}
    </div>
  );
}
