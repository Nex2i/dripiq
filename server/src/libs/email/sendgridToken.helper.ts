export class SendgridTokenHelper {
  static extractTokenFromUrlOrToken(input: string): string | null {
    try {
      const trimmed = input?.trim();
      if (!trimmed) return null;

      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const url = new URL(trimmed);

        // 1) Direct token on the URL
        const directToken = url.searchParams.get('token');
        if (directToken) return directToken;

        // 2) Nested URL inside common wrapper params (Safe Links, redirectors, etc.)
        const nestedParamKeys = ['url', 'u', 'target', 'destination', 'redirect', 'redir', 'r', 'd'];
        for (const key of nestedParamKeys) {
          const nested = url.searchParams.get(key);
          if (!nested) continue;

          let candidate = nested;
          // Try decoding a couple times to unwrap percent-encoding
          for (let i = 0; i < 2; i++) {
            try {
              candidate = decodeURIComponent(candidate);
            } catch {
              break;
            }
          }

          // If text contains a token query, extract via regex
          const tokenFromTextMatch =
            candidate.match(/[?&]token=([^&]+)/) || candidate.match(/token=([^&]+)/);
          if (tokenFromTextMatch) return tokenFromTextMatch[1]!;

          // Proofpoint-style encodings handling inside nested param
          const proofpointTokenMatch = candidate.match(/token-3D([^\s]+?)(?:-26|$)/i);
          if (proofpointTokenMatch) {
            const encoded = proofpointTokenMatch[1]!;
            const decoded = encoded.replace(/-([0-9A-F]{2})/gi, (_m, h) =>
              String.fromCharCode(parseInt(h, 16))
            );
            return decoded;
          }

          if (/https?-3A__/i.test(candidate)) {
            const scheme = candidate.toLowerCase().startsWith('https-3a__') ? 'https://' : 'http://';
            const afterScheme = candidate.replace(/^https?-3A__?/i, '');
            const decodedRest = afterScheme.replace(/-([0-9A-F]{2})/gi, (_m, h) =>
              String.fromCharCode(parseInt(h, 16))
            );
            const rebuilt = scheme + decodedRest.replace(/_+/g, '/');
            try {
              const inner = new URL(rebuilt);
              const innerToken = inner.searchParams.get('token');
              if (innerToken) return innerToken;
            } catch {
              // ignore
            }
          }

          // Else, if it looks like a URL, parse and read its search params
          if (/^https?:\/\//i.test(candidate)) {
            try {
              const inner = new URL(candidate);
              const innerToken = inner.searchParams.get('token');
              if (innerToken) return innerToken;
            } catch {
              // ignore and continue
            }
          }
        }

        // 3) Last resort: regex over the entire original input
        const tokenMatch = trimmed.match(/[?&]token=([^&]+)/) || trimmed.match(/token=([^&]+)/);
        if (tokenMatch) return tokenMatch[1]!;

        return null;
      }

      // Non-URL input handling
      // a) token=<value> pattern in raw text
      const rawTokenMatch = trimmed.match(/(?:\b|[?&])token=([^&\s]+)/i);
      if (rawTokenMatch) return rawTokenMatch[1]!;

      // b) Proofpoint token-3D<value> pattern
      const ppTokenMatch = trimmed.match(/token-3D([^\s]+?)(?:-26|$)/i);
      if (ppTokenMatch) {
        const encoded = ppTokenMatch[1]!;
        const decoded = encoded.replace(/-([0-9A-F]{2})/gi, (_m, h) =>
          String.fromCharCode(parseInt(h, 16))
        );
        return decoded;
      }

      // c) Proofpoint full URL-like string e.g., https-3A__...
      if (/https?-3A__/i.test(trimmed)) {
        const scheme = trimmed.toLowerCase().startsWith('https-3a__') ? 'https://' : 'http://';
        const afterScheme = trimmed.replace(/^https?-3A__?/i, '');
        const decodedRest = afterScheme.replace(/-([0-9A-F]{2})/gi, (_m, h) =>
          String.fromCharCode(parseInt(h, 16))
        );
        const rebuilt = scheme + decodedRest.replace(/_+/g, '/');
        try {
          const inner = new URL(rebuilt);
          const innerToken = inner.searchParams.get('token');
          if (innerToken) return innerToken;
        } catch {
          // ignore
        }
      }

      // If not a URL and no patterns matched, assume the input is the token itself
      return trimmed;
    } catch {
      const tokenMatch = input.match(/token=([^&]+)/);
      return tokenMatch ? tokenMatch[1]! : null;
    }
  }
}