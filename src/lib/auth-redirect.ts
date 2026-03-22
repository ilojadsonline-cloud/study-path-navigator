const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

const FALLBACK_PUBLIC_URL = "https://www.metodochoa.com.br";

export function getAuthRedirectUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const configuredBaseUrl = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();

  if (configuredBaseUrl) {
    return `${configuredBaseUrl.replace(/\/$/, "")}${normalizedPath}`;
  }

  if (typeof window !== "undefined" && !LOCALHOST_HOSTS.has(window.location.hostname)) {
    return `${window.location.origin}${normalizedPath}`;
  }

  return `${FALLBACK_PUBLIC_URL}${normalizedPath}`;
}