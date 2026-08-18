// Plan paylaşımı: planı unicode-güvenli base64 koda çevirir / geri okur.

export function encodePlan(plan) {
  const json = JSON.stringify(plan);
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodePlan(code) {
  try {
    const json = decodeURIComponent(escape(atob(code)));
    const plan = JSON.parse(json);
    return { ...plan, id: crypto.randomUUID() };
  } catch {
    return null;
  }
}

export function buildShareUrl(plan) {
  const code = encodePlan(plan);
  return `${window.location.origin}/?p=${code}`;
}
