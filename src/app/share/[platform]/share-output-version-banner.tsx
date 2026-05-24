"use client";

import Link from "next/link";
import { buildShareListHref } from "@/lib/share/share-list-contract";
import type { SharePlatform } from "@/lib/share/share-platform";

type Props = {
  platform: SharePlatform;
  productId: string;
  createdAt: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

export function ShareOutputVersionBanner({ platform, productId, createdAt }: Props) {
  const latestHref = buildShareListHref({ platform, detailId: productId, tab: "output" });
  return (
    <div className="output-version-banner" role="status">
      <span className="output-version-banner__label">Versi lama — {formatDate(createdAt)}</span>
      <Link className="compact" href={latestHref}>
        Kembali ke Terbaru
      </Link>
    </div>
  );
}
