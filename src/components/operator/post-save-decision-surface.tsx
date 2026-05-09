"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { saveIntake } from "@/app/intake/actions";
import { OperatorBottomSheet } from "@/components/operator/bottom-sheet";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import { StatusBadge } from "@/components/operator/status-badge";

type PostSaveDecisionSurfaceProps = {
  affiliateProfileId: string | null;
  intakeId: string;
  open: boolean;
  showAllWorkspaces: boolean;
};

function useMounted() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");

    function update() {
      setIsMobile(media.matches);
    }

    update();
    media.addEventListener("change", update);

    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function buildReplaceHref(pathname: string, searchParams: ReturnType<typeof useSearchParams>) {
  const nextParams = new URLSearchParams(searchParams.toString());
  nextParams.delete("post_save");
  const query = nextParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function DecisionContent({
  createButtonLabel,
  continueButtonLabel,
  onContinue,
  showAllWorkspaces,
  affiliateProfileId,
  intakeId,
}: {
  createButtonLabel: string;
  continueButtonLabel: string;
  onContinue: () => void;
  showAllWorkspaces: boolean;
  affiliateProfileId: string | null;
  intakeId: string;
  }) {
  return (
    <section className="stack-tight">
      <section className="muted-box stack-tight">
        <div className="intake-save-decision__note">
          <Lock className="intake-save-decision__note-icon" size={18} strokeWidth={2.25} aria-hidden="true" />
          <span>Evidence terkunci sampai kamu pilih aksi berikutnya.</span>
        </div>
      </section>

      <form action={saveIntake} className="stack-tight">
        <input type="hidden" name="intent" value="archive_intake_session" />
        <input type="hidden" name="id" value={intakeId} />
        <input type="hidden" name="workspace_scope" value={showAllWorkspaces ? "all" : ""} />
        <input type="hidden" name="affiliate_profile_id" value={affiliateProfileId ?? ""} />

        <div className="intake-save-decision__actions">
          <button className="button primary" type="button" onClick={onContinue}>
            {continueButtonLabel}
          </button>
          <PendingActionButton className="button tertiary" pendingLabel="Memproses" type="submit">
            {createButtonLabel}
          </PendingActionButton>
        </div>
      </form>
    </section>
  );
}

function DesktopDecisionModal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <>
      <button className="intake-save-decision-modal__backdrop" aria-label="Tutup pilihan simpan" type="button" onClick={onClose} />
      <aside className="intake-save-decision-modal" aria-label="Opsi setelah simpan produk" aria-modal="true" role="dialog">
        <div className="intake-save-decision-modal__header">
          <div className="stack-tight">
            <strong>Produk tersimpan</strong>
            <span className="settings-card-meta-line">Pilih lanjutkan draft yang sama atau mulai draft baru.</span>
          </div>
          <StatusBadge status="Terkunci" tone="warning" />
        </div>
        <div className="intake-save-decision-modal__body">{children}</div>
      </aside>
    </>,
    document.body,
  );
}

export function PostSaveDecisionSurface({
  affiliateProfileId,
  intakeId,
  open,
  showAllWorkspaces,
}: PostSaveDecisionSurfaceProps) {
  const mounted = useMounted();
  const isMobile = useIsMobileViewport();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isVisible, setIsVisible] = useState(open);

  useEffect(() => {
    setIsVisible(open);
  }, [open]);

  if (!mounted || !isVisible) {
    return null;
  }

  const continueButtonLabel = isMobile ? "Lanjut" : "Lanjutkan sesi ini";
  const createButtonLabel = isMobile ? "Buat baru" : "Buat produk baru";

  function closeDecisionSurface() {
    setIsVisible(false);
    router.replace(buildReplaceHref(pathname, searchParams), { scroll: false });
  }

  const content = (
    <DecisionContent
      affiliateProfileId={affiliateProfileId}
      continueButtonLabel={continueButtonLabel}
      createButtonLabel={createButtonLabel}
      intakeId={intakeId}
      onContinue={closeDecisionSurface}
      showAllWorkspaces={showAllWorkspaces}
    />
  );

  if (isMobile) {
    return (
      <OperatorBottomSheet ariaLabel="Opsi setelah simpan produk" open={open} subtitle="Evidence terkunci sampai kamu memilih." title="Produk tersimpan" onClose={closeDecisionSurface}>
        {content}
      </OperatorBottomSheet>
    );
  }

  return <DesktopDecisionModal onClose={closeDecisionSurface}>{content}</DesktopDecisionModal>;
}
