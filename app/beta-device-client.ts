import type {
  BetaTextScale,
  InputMode,
  ViewportBucket,
} from "./beta-device-server";

export type ClientBetaDeviceProfile = {
  inputMode: InputMode;
  textScale: BetaTextScale;
  viewport: ViewportBucket;
};

export function readClientBetaDeviceProfile(
  textScale: BetaTextScale,
): ClientBetaDeviceProfile {
  const viewport: ViewportBucket =
    window.innerWidth <= 560
      ? "small"
      : window.innerWidth <= 900
        ? "medium"
        : "large";
  const hasTouch = window.matchMedia("(any-pointer: coarse)").matches;
  const hasPointer = window.matchMedia("(any-pointer: fine)").matches;
  const inputMode: InputMode =
    hasTouch && hasPointer ? "hybrid" : hasTouch ? "touch" : "pointer";
  return { inputMode, textScale, viewport };
}
