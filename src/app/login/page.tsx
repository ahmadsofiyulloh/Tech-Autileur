import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { LoginForm } from "./login-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
    redirect("/dashboard");
  }

  const query = searchParams ? await searchParams : null;

  return (
    <div className="stack">
      <section className="hero">
        <div className="auth-hero__main">
          <span className="icon-frame" aria-hidden="true">
            <LockKeyhole size={19} />
          </span>
          <div className="stack-tight">
            <h2>Operator sign in</h2>
          </div>
        </div>
      </section>

      <LoginForm
        bannerMessage={readSearchParam(query?.message)}
        bannerError={readSearchParam(query?.error)}
      />
    </div>
  );
}
