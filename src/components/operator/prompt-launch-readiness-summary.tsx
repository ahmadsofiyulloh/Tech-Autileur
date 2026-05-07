"use client";

import Link from "next/link";
import type { PromptLaunchReadiness } from "@/lib/prompts/prompt-launch-readiness";

type PromptLaunchReadinessSummaryProps = {
  readiness: PromptLaunchReadiness;
  className?: string;
  id?: string;
};

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function PromptLaunchReadinessSummary({ className, id, readiness }: PromptLaunchReadinessSummaryProps) {
  const wrapperClassName = joinClassNames(
    "prompt-launch-readiness stack-tight",
    readiness.ready ? "success-box" : "error-box",
    className,
  );
  const toneClassName = readiness.ready ? "status-badge--success" : "status-badge--warning";

  return (
    <section className={wrapperClassName} id={id}>
      <div className="section-card__actions">
        <strong>Kesiapan Prompt</strong>
        <span className={`status-badge ${toneClassName}`}>{readiness.ready ? "Siap" : "Belum siap"}</span>
      </div>

      {!readiness.ready ? (
        <ul className="list">
          {readiness.blockers.map((blocker) => (
            <li key={blocker.key}>
              <strong>{blocker.label}</strong>
              <Link className="button compact tertiary" href={blocker.href}>
                Buka
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
