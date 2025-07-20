const MAX_CHARS_PER_CHUNK = 8000;
const MIN_CHARS_PER_CHUNK = 500;
const MIN_CONTACT_CHUNK = 100;

export function chunkMarkdownForEmbedding(pureMarkdown: string): string[] {
  const markdown = pureMarkdown; // Clean later
  const lines = markdown.split('\n');
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;
  let lastWasContact = false;

  const flushChunk = (force = false) => {
    if (currentChunk.length === 0) return;
    const combined = currentChunk.join('\n').trim();
    const isContactChunk = currentChunk.some(containsContactInfo);

    if (
      combined.length >= MIN_CHARS_PER_CHUNK ||
      (isContactChunk && combined.length >= MIN_CONTACT_CHUNK) ||
      force
    ) {
      chunks.push(combined);
      lastWasContact = isContactChunk;
    } else if (chunks.length > 0) {
      chunks[chunks.length - 1] += '\n\n' + combined;
    }
    currentChunk = [];
    currentLength = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const trimmed = line.trim();
    const isHeading = /^#+\s/.test(trimmed);
    const isContact = containsContactInfo(trimmed);
    const isContactHead = isContactHeading(trimmed);

    // Flush if we're about to hit a new semantic block, or exceed max size
    if (
      currentLength + trimmed.length > MAX_CHARS_PER_CHUNK ||
      (isHeading && currentLength > 0) ||
      (isContactHead && currentLength > 0)
    ) {
      flushChunk();
    }

    currentChunk.push(line);
    currentLength += trimmed.length;

    // If a line with direct contact info and last chunk was not contact, consider flushing early
    if (isContact && !lastWasContact && currentLength >= MIN_CONTACT_CHUNK) {
      flushChunk();
    }
  }
  flushChunk(true); // force flush last
  return chunks.map(cleanMarkdown); // Clean after chunking
}

const SOCIAL_DOMAINS = [
  'twitter.com',
  'facebook.com',
  'linkedin.com',
  'instagram.com',
  'tiktok.com',
  'youtube.com',
  'discord.gg',
  'discord.com',
  'snapchat.com',
  'github.com',
  'medium.com',
  'threads.net',
  'pinterest.com',
  'reddit.com',
];

// Helper to check if a URL is social
function isSocialLink(url: string): boolean {
  return SOCIAL_DOMAINS.some((domain) => url.toLowerCase().includes(domain));
}

// Remove only social markdown links, keep other links as-is
export function cleanMarkdown(pureMarkdown: string): string {
  return (
    pureMarkdown
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`[^`]*`/g, '')
      // Remove images ![alt](url)
      .replace(/!\[.*?\]\(.*?\)/g, '')
      // Remove markdown social links: [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, _text, url) => {
        return isSocialLink(url) ? '' : match;
      })
      // Remove plain social URLs (entire line if it's only a social URL)
      .replace(
        new RegExp(
          `^\\s*https?:\\/\\/(www\\.)?(${SOCIAL_DOMAINS.map((d) => d.replace('.', '\\.')).join('|')})[\\w\\/.\\-?&=%#@]*\\s*$`,
          'gim'
        ),
        ''
      )
      // Remove inline social URLs
      .replace(
        new RegExp(
          `https?:\\/\\/(www\\.)?(${SOCIAL_DOMAINS.map((d) => d.replace('.', '\\.')).join('|')})[\\w\\/.\\-?&=%#@]*`,
          'gi'
        ),
        ''
      )
      // Remove headings
      .replace(/^#{1,6}\s+/gm, '')
      // Remove blockquotes
      .replace(/^\s*>\s?/gm, '')
      // Remove lists
      .replace(/^\s*([-*+]|\d+\.)\s+/gm, '')
      // Remove bold and italics
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      // Remove strikethrough
      .replace(/~~(.*?)~~/g, '$1')
      // Remove tables
      .replace(/^\|.*\|$/gm, '')
      // Remove horizontal rules
      .replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Remove footnotes like [^1] or [1]:
      .replace(/\[\^?\d+\]/g, '')
      .replace(/^\[\d+\]: .*$/gm, '')
      // Replace multiple newlines with a single newline
      .replace(/\n{2,}/g, '\n')
      // Trim whitespace
      .trim()
  );
}

const isContactHeading = (line: string) =>
  /contact|reach|get in touch|email|phone|address|find us/i.test(line);

const containsContactInfo = (line: string) =>
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(line) ||
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(line) || // phone
  /\b\d{1,5} [A-Za-z].*(Street|St|Avenue|Ave|Blvd|Road|Rd|Suite|Ste|Unit)\b/i.test(line); // address
