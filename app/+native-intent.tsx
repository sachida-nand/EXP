// Intercept system-level deep links before expo-router parses them as routes.
// If a `dataUrl=` URL ever leaks through the standard Linking pipeline (some
// versions of expo-share-intent also fire it there), route to "/" so we
// don't show a 404. The actual share-intent navigation is handled in
// app/(app)/_layout.tsx via the ShareIntentBridge, which mounts only after
// the (app) navigator is ready.
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  if (path && path.includes('dataUrl=')) {
    return '/';
  }
  return path;
}
