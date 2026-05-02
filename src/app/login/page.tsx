import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: {
    message?: string | string[];
    error?: string | string[];
  };
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
    redirect("/dashboard");
  }

  return (
    <div className="stack">
      <section className="hero">
        <div className="chip">Sprint 1 auth</div>
        <div className="stack">
          <p className="eyebrow">Affiliate AI Content OS</p>
          <h2>Protected single-owner workspace.</h2>
          <p>
            Auth now fronts the MVP. Log in to reach the protected dashboard and let Supabase bootstrap your profile
            row automatically.
          </p>
        </div>
      </section>

      <LoginForm
        bannerMessage={readSearchParam(searchParams?.message)}
        bannerError={readSearchParam(searchParams?.error)}
      />
    </div>
  );
}
