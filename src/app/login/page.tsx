import { redirect } from "next/navigation";
import { Bot, Code2, Database, Globe2, LockKeyhole, Sparkles, UserRound } from "lucide-react";
import { LoginForm } from "./login-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 300;

type LoginPageProps = {
  searchParams?: Promise<{
    message?: string | string[];
    error?: string | string[];
  }>;
};

function readSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/products/new");
  }

  const query = searchParams ? await searchParams : null;

  return (
    <div className="auth-screen">
      <section className="auth-visual-panel" aria-label="Affiliate AI">
        <div className="auth-brand-lockup">
          <span className="auth-brand-mark" aria-hidden="true">
            <LockKeyhole size={20} />
          </span>
          <span>
            Affiliate <strong>AI</strong>
          </span>
        </div>

        <div className="auth-illustration" aria-hidden="true">
          <span className="auth-circuit auth-circuit--top-left" />
          <span className="auth-circuit auth-circuit--top-right" />
          <span className="auth-circuit auth-circuit--bottom-left" />
          <span className="auth-circuit auth-circuit--bottom-right" />

          <div className="auth-ai-core">
            <span className="auth-ai-core__base" />
            <span className="auth-ai-core__chip">
              <Sparkles size={18} />
              <span>AI</span>
            </span>
          </div>

          <div className="auth-visual-node auth-visual-node--profile">
            <span className="auth-node-device">
              <UserRound size={38} />
              <strong>AI</strong>
            </span>
          </div>

          <div className="auth-visual-node auth-visual-node--code">
            <span className="auth-node-device auth-node-device--upright">
              <Code2 size={38} />
            </span>
          </div>

          <div className="auth-visual-node auth-visual-node--globe">
            <span className="auth-node-device auth-node-device--upright">
              <Globe2 size={36} />
            </span>
          </div>

          <div className="auth-visual-node auth-visual-node--data">
            <span className="auth-node-device auth-node-device--stack">
              <Database size={34} />
            </span>
          </div>

          <span className="auth-ai-bot">
            <Bot size={28} />
          </span>
        </div>
      </section>

      <section className="auth-login-panel" aria-labelledby="login-title">
        <div className="auth-card">
          <span className="auth-mobile-lock" aria-hidden="true">
            <LockKeyhole size={18} />
          </span>
          <h1 id="login-title">Masuk Operator</h1>
          <p className="auth-login-subtitle">Lanjutkan produksi konten AI.</p>

          <LoginForm
            bannerMessage={readSearchParam(query?.message)}
            bannerError={readSearchParam(query?.error)}
          />
        </div>
      </section>
    </div>
  );
}
