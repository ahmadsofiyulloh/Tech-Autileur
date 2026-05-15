import { redirect } from "next/navigation";

type ProductDetailRedirectPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProductDetailRedirectPage({ params, searchParams }: ProductDetailRedirectPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const targetSearchParams = new URLSearchParams({ detail: id });
  const tab = firstParam(query.tab);

  if (tab === "prompt_pack") {
    targetSearchParams.set("tab", "history");
  } else if (tab) {
    targetSearchParams.set("tab", tab);
  }

  for (const key of ["affiliate_profile_id", "workspace", "message", "warning", "error"]) {
    const value = firstParam(query[key]);

    if (value) {
      targetSearchParams.set(key, value);
    }
  }

  redirect(`/products?${targetSearchParams.toString()}`);
}
