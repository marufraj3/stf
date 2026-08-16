import React, { ImgHTMLAttributes, useEffect, useState } from 'react';
import { apiBlobUrl, apiDownload } from '../../services/api';

function isApiFile(source?: string | null): source is string {
  return Boolean(source?.startsWith('/files/'));
}

export function useSecureFileUrl(source?: string | null): {
  url: string;
  loading: boolean;
  error: string;
} {
  const [url, setUrl] = useState(() => isApiFile(source) ? '' : source || '');
  const [loading, setLoading] = useState(isApiFile(source));
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setError('');
    if (!source || !isApiFile(source)) {
      setUrl(source || '');
      setLoading(false);
      return () => undefined;
    }
    setUrl('');
    setLoading(true);
    apiBlobUrl(source)
      .then(nextUrl => {
        objectUrl = nextUrl;
        if (active) setUrl(nextUrl);
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to open file.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source]);

  return { url, loading, error };
}

export function SecureImage({
  source,
  alt,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { source?: string | null }) {
  const file = useSecureFileUrl(source);
  if (!file.url) return null;
  return <img src={file.url} alt={alt || ''} {...props} />;
}

export async function downloadSecureFile(source: string, filename = 'document'): Promise<void> {
  if (isApiFile(source)) {
    await apiDownload(source);
    return;
  }
  const link = document.createElement('a');
  link.href = source;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
