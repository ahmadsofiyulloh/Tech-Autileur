import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
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
        <div className="page-header__main">
          <span className="icon-frame" aria-hidden="true">
            <LockKeyhole size={19} />
          </span>
          <div className="stack-tight">
            <div className="chip">Private</div>
            <h2>Operator sign in</h2>
            <p>Use the owner account.</p>
          </div>
        </div>
      </section>

      <LoginForm
        bannerMessage={readSearchParam(searchParams?.message)}
        bannerError={readSearchParam(searchParams?.error)}
      />
    </div>
  );
}
