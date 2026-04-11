export async function shareContent(text: string, title?: string): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({ title: title || "Smart Reply AI", text });
      return true;
    } catch (e) {
      if ((e as Error).name !== "AbortError") console.error("Share failed:", e);
      return false;
    }
  }
  return copyToClipboard(text);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers / webview
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

export function openExternalLink(url: string) {
  // Safe external link handling for both web and Capacitor contexts
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.click();
}
