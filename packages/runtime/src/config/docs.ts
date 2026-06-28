const DEFAULT_DOCS_PUBLIC_URL = 'https://docs.a2amesh.local/';

function normalizeDocsPublicUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_DOCS_PUBLIC_URL;
  }

  const url = new URL(trimmed.endsWith('/') ? trimmed : `${trimmed}/`);
  return url.toString();
}

const DOCS_PUBLIC_URL = normalizeDocsPublicUrl(
  process.env['A2AMESH_DOCS_PUBLIC_URL'] ?? DEFAULT_DOCS_PUBLIC_URL,
);

export function getDocsUrl(path = ''): string {
  if (!path) {
    return DOCS_PUBLIC_URL;
  }

  const normalizedPath = path.replace(/^\/+/, '');
  return new URL(normalizedPath, DOCS_PUBLIC_URL).toString();
}
