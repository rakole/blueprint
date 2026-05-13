function looksLikeXmlTagBoundary(value: string): boolean {
  return /^<\/?[A-Za-z][A-Za-z0-9:_-]*(?:\s[^>]*)?>/.test(value)
    || /<\/[A-Za-z][A-Za-z0-9:_-]*>/.test(value);
}

export function isObviouslyNonPathMarkupToken(
  rawToken: string,
  normalizedToken?: string
): boolean {
  const raw = rawToken.trim();
  const normalized = (normalizedToken ?? rawToken).trim();

  if (raw.length === 0 && normalized.length === 0) {
    return false;
  }

  if (/\$\{[^}]+\}/.test(raw) || /\$\{[^}]+\}/.test(normalized)) {
    return true;
  }

  if (looksLikeXmlTagBoundary(raw)) {
    return true;
  }

  return /^<\/?[A-Za-z][A-Za-z0-9:_-]*>/.test(normalized)
    || (/^[A-Za-z][A-Za-z0-9:_-]*>/.test(normalized)
      && /<\/[A-Za-z][A-Za-z0-9:_-]*>/.test(normalized));
}
