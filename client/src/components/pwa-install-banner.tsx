import { useEffect, useState, useRef, useCallback } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "fuelflow-pwa-install-dismissed-at";
/** Set when the user completes install or opens the installed app — hides banner in the browser tab too. */
const INSTALLED_KEY = "fuelflow-pwa-installed";
/** Don't show again for this long after dismiss (×). */
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

function isStandaloneDisplay(): boolean {
  const mq = (mode: string) => window.matchMedia(`(display-mode: ${mode})`).matches;
  return (
    mq("standalone") ||
    mq("fullscreen") ||
    mq("minimal-ui") ||
    mq("window-controls-overlay") ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function wasInstalled(): boolean {
  try {
    return localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    return false;
  }
}

function markInstalled(): void {
  try {
    localStorage.setItem(INSTALLED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** True if we should never show the banner (sync, before paint where possible). */
function shouldSuppressBanner(): boolean {
  if (typeof window === "undefined") return true;
  if (isStandaloneDisplay()) {
    markInstalled();
    return true;
  }
  if (wasInstalled()) return true;
  return false;
}

function isLikelyIosSafari(): boolean {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (!iOS && !iPadOS) return false;
  // Chrome on iOS still uses WebKit; no beforeinstallprompt — show Add to Home Screen hint
  return true;
}

function dismissCooldownActive(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const at = parseInt(raw, 10);
    if (Number.isNaN(at)) return false;
    return Date.now() - at < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function recordDismiss(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * Chromium/Edge/Android: native install via beforeinstallprompt.
 * iOS Safari: instructions only (Share → Add to Home Screen).
 */
export function PwaInstallBanner() {
  const [suppressed, setSuppressed] = useState(shouldSuppressBanner);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [open, setOpen] = useState(false);
  const gotChromiumPrompt = useRef(false);

  const handleDismiss = useCallback(() => {
    recordDismiss();
    setOpen(false);
    setShowIosHint(false);
    setDeferredPrompt(null);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        markInstalled();
        setSuppressed(true);
      }
    } catch {
      /* user cancelled or prompt failed */
    }
    setDeferredPrompt(null);
    setOpen(false);
  }, [deferredPrompt]);

  useEffect(() => {
    if (suppressed) return;
    if (dismissCooldownActive()) return;

    const onBeforeInstallPrompt = (e: Event) => {
      if (isStandaloneDisplay() || wasInstalled()) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      gotChromiumPrompt.current = true;
      setShowIosHint(false);
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setOpen(true);
    };

    const onAppInstalled = () => {
      markInstalled();
      setSuppressed(true);
      setOpen(false);
      setDeferredPrompt(null);
      setShowIosHint(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    const t = window.setTimeout(() => {
      if (gotChromiumPrompt.current) return;
      if (!isLikelyIosSafari()) return;
      if (dismissCooldownActive()) return;
      if (wasInstalled() || isStandaloneDisplay()) return;
      setShowIosHint(true);
      setOpen(true);
    }, 2800);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.clearTimeout(t);
    };
  }, [suppressed]);

  if (suppressed || !open) return null;

  return (
    <div
      id="pwa-install-prompt"
      className="fixed left-3 right-3 z-[60] max-[767px]:bottom-[5.5rem] bottom-4 md:left-auto md:right-4 md:max-w-md md:bottom-6 pointer-events-none"
      role="region"
      aria-label="Install app"
    >
      <div className="pointer-events-auto rounded-lg border border-border bg-card text-card-foreground shadow-lg ring-1 ring-black/5 dark:ring-white/10 p-4 pr-10 relative">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="font-semibold text-sm pr-6">Install FuelFlow</p>
        <p className="text-sm text-muted-foreground mt-1">
          {showIosHint
            ? "Add to Home Screen for quick access: tap Share, then Add to Home Screen."
            : "Add to home screen for quick access."}
        </p>
        {!showIosHint && deferredPrompt ? (
          <Button type="button" size="sm" className="mt-3 gap-2" onClick={handleInstall}>
            <Download className="h-4 w-4" />
            Install
          </Button>
        ) : null}
      </div>
    </div>
  );
}
