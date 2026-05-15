import { redirect } from "next/navigation";

type PromptDetailRedirectPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PromptDetailRedirectPage({ params, searchParams }: PromptDetailRedirectPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const targetSearchParams = new URLSearchParams({ detail: id });

  for (const key of ["affiliate_profile_id", "product_id", "intake_id", "message", "warning", "error"]) {
    const value = firstParam(query[key]);

    if (value) {
      targetSearchParams.set(key, value);
    }
  }

  redirect(`/prompts?${targetSearchParams.toString()}`);
}
