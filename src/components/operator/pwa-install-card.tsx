"use client";

import { Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type WindowWithBeforeInstallPrompt = Window & {
  __aicosBeforeInstallPromptEvent?: BeforeInstallPromptEvent | null;
};

function isStandaloneDisplay() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };

  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function isIosSafari() {
  const userAgent = window.navigator.userAgent;
  const isIpadOS = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  const isIos = /iphone|ipad|ipod/i.test(userAgent) || isIpadOS;
  const isOtherIosBrowser = /crios|fxios|edgios|opios/i.test(userAgent);

  return isIos && !isOtherIosBrowser;
}

export function PwaInstallCard() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);

  useEffect(() => {
    const displayModeQuery = window.matchMedia("(display-mode: standalone)");
    const windowWithPrompt = window as WindowWithBeforeInstallPrompt;

    function syncDisplayMode() {
      setIsInstalled(isStandaloneDisplay());
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      const installPrompt = event as BeforeInstallPromptEvent;
      windowWithPrompt.__aicosBeforeInstallPromptEvent = installPrompt;
      setDeferredPrompt(installPrompt);
    }

    function handleInstalled() {
      windowWithPrompt.__aicosBeforeInstallPromptEvent = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
    }

    syncDisplayMode();
    setIsIos(isIosSafari());
    setDeferredPrompt(windowWithPrompt.__aicosBeforeInstallPromptEvent ?? null);
    setIsReady(true);

    const handleBridgeBeforeInstallPrompt = () => {
      setDeferredPrompt(windowWithPrompt.__aicosBeforeInstallPromptEvent ?? null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("aicos-beforeinstallprompt", handleBridgeBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    displayModeQuery.addEventListener("change", syncDisplayMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("aicos-beforeinstallprompt", handleBridgeBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      displayModeQuery.removeEventListener("change", syncDisplayMode);
    };
  }, []);

  if (!isReady || isInstalled || (!deferredPrompt && !isIos)) {
    return null;
  }

  async function handleInstallClick() {
    if (!deferredPrompt) {
      return;
    }

    setIsPrompting(true);

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);

      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      }
    } finally {
      setIsPrompting(false);
    }
  }

  return (
    <section className="pwa-install-card" aria-label="Pasang app">
      <span className="pwa-install-card__icon" aria-hidden="true">
        <Smartphone size={18} />
      </span>
      <span className="pwa-install-card__copy">
        <strong>Pasang app</strong>
        <span>{deferredPrompt ? "Buka seperti app native." : "Bagikan lalu Tambah ke Layar Utama."}</span>
      </span>
      {deferredPrompt ? (
        <button className="button compact primary pwa-install-card__action" disabled={isPrompting} type="button" onClick={handleInstallClick}>
          <Download size={15} aria-hidden="true" />
          {isPrompting ? "Membuka" : "Pasang"}
        </button>
      ) : null}
    </section>
  );
}
