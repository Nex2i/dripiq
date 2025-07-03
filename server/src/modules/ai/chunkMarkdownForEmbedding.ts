const MAX_CHARS_PER_CHUNK = 8000; // ~2000 tokens
const MIN_CHARS_PER_CHUNK = 500; // Avoids tiny fragments

export function chunkMarkdownForEmbedding(markdown: string): string[] {
  const lines = markdown.split('\n');

  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  const flushChunk = () => {
    if (currentChunk.length === 0) return;
    const combined = currentChunk.join('\n').trim();
    if (combined.length >= MIN_CHARS_PER_CHUNK || chunks.length === 0) {
      chunks.push(combined);
    } else if (chunks.length > 0) {
      // Merge small chunk with previous
      chunks[chunks.length - 1] += '\n\n' + combined;
    }
    currentChunk = [];
    currentLength = 0;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Treat headings or blank lines as natural break points
    const isHeading = /^#+\s/.test(trimmed);
    const isBlank = trimmed === '';

    // If adding this line would exceed limit, flush
    if (currentLength + trimmed.length > MAX_CHARS_PER_CHUNK) {
      flushChunk();
    }

    // Push line
    currentChunk.push(line);
    currentLength += trimmed.length;

    // On blank line or heading, consider flushing
    if ((isHeading || isBlank) && currentLength >= MAX_CHARS_PER_CHUNK * 0.8) {
      flushChunk();
    }
  }

  flushChunk(); // final flush
  return chunks;
}
