// Fullscreen on load (best-effort); most browsers require a gesture, so we retry on first tap/key.

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
};

export function isAppFullscreen(): boolean {
  return Boolean(
    document.fullscreenElement ??
      (document as Document & { webkitFullscreenElement?: Element })
        .webkitFullscreenElement,
  );
}

export function requestAppFullscreen(): void {
  if (isAppFullscreen()) return;

  const el = document.documentElement as FullscreenElement;
  const request =
    el.requestFullscreen?.bind(el) ??
    el.webkitRequestFullscreen?.bind(el) ??
    el.msRequestFullscreen?.bind(el);

  if (request) void request().catch(() => {});
}
