import { chunkMarkdownForEmbedding, cleanMarkdown } from './chunkMarkdownForEmbedding';

const makeMarkdown = (length: number, char = 'a') => Array(length).fill(char).join('');

// Simple contact examples
const EMAIL = 'test@example.com';
const PHONE = '555-555-5555';
const ADDRESS = '123 Main Street';

// Helper for visualizing chunk lengths (for debugging)
// const debugChunks = (chunks: string[]) => chunks.forEach((c, i) => console.log(i, c.length, c.slice(0, 30)));

describe('chunkMarkdownForEmbedding', () => {
  test('chunks short markdown as a single chunk', () => {
    const input = 'This is a short markdown file.';
    const result = chunkMarkdownForEmbedding(input);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('short markdown');
  });

  test('empty string returns zero or one empty chunk', () => {
    const result = chunkMarkdownForEmbedding('');
    expect(result.length === 0 || (result.length === 1 && result[0] === '')).toBe(true);
  });

  test('chunks exactly MAX_CHARS_PER_CHUNK into one chunk', () => {
    const input = makeMarkdown(8000, 'x');
    const result = chunkMarkdownForEmbedding(input);
    expect(result).toHaveLength(1);
    expect(result[0]!.length).toBe(8000);
  });

  test('splits at MAX_CHARS_PER_CHUNK + 1', () => {
    // Add line breaks every 1000 to trigger splitting
    const input = Array(8).fill(makeMarkdown(1000, 'x')).join('\n') + '\n' + makeMarkdown(1, 'x');
    const result = chunkMarkdownForEmbedding(input);
    // You should get 2 chunks if the logic splits on length
    expect(result.length).toBeGreaterThan(1);
    // No chunk should be drastically bigger than MAX, but off-by-some is ok
    expect(result.every((chunk) => chunk.length <= 8100)).toBe(true); // allow for small overage
  });

  test('merges small leftover chunks (avoids tiny trailing fragments)', () => {
    // 4000 + 400 + 4000; middle should get merged forward or back
    const chunks = [makeMarkdown(4000, 'a'), makeMarkdown(400, 'b'), makeMarkdown(4000, 'c')].join(
      '\n\n'
    );
    const result = chunkMarkdownForEmbedding(chunks);
    expect(result.every((chunk) => chunk.length >= 500 || result.indexOf(chunk) === 0)).toBe(true);
  });

  test('splits at headings', () => {
    const input = [
      '# Heading 1',
      makeMarkdown(700, 'a'),
      '# Heading 2',
      makeMarkdown(700, 'b'),
      '# Heading 3',
      makeMarkdown(700, 'c'),
    ].join('\n');
    const result = chunkMarkdownForEmbedding(input);
    expect(result.length).toBe(3);
    result.forEach((chunk) => expect(chunk.length).toBeGreaterThan(500));
  });

  test('splits at contact heading', () => {
    const input = ['Some intro', '## Contact', 'Reach us at test@example.com'].join('\n');
    const result = chunkMarkdownForEmbedding(input);
    // Each contact chunk must be at least 100 chars or get merged
    expect(result.some((chunk) => chunk.includes('test@example.com'))).toBe(true);
  });

  test.each([
    [`Has email`, EMAIL],
    [`Has phone`, PHONE],
    [`Has address`, ADDRESS],
  ])('%s in markdown creates contact chunk', (_, contact) => {
    const input = [
      '# Some heading',
      'Blah blah blah',
      `Contact info: ${contact}`,
      makeMarkdown(200, 'a'),
    ].join('\n');
    const result = chunkMarkdownForEmbedding(input);
    expect(result.some((chunk) => chunk.includes(contact))).toBe(true);
  });

  test('splits large markdown into multiple correct-size chunks', () => {
    const a = makeMarkdown(4000, 'a');
    const b = makeMarkdown(4000, 'b');
    const c = makeMarkdown(4000, 'c');
    const input = [a, b, c].join('\n\n'); // ensure splitting
    const result = chunkMarkdownForEmbedding(input);
    expect(result.length).toBeGreaterThan(1);
    expect(Math.abs(result.join('').length - cleanMarkdown(input).length)).toBeLessThanOrEqual(2);
    expect(result.every((chunk) => chunk.length <= 8100)).toBe(true);
  });

  test('removes markdown social links but keeps others', () => {
    const input = `
      Regular link: [Example](https://example.com)
      Social link: [Twitter](https://twitter.com/testuser)
      Another social: [LinkedIn](https://linkedin.com/in/test)
      Not social: [Docs](https://docs.example.com)
    `;
    const result = cleanMarkdown(input);

    // Social links should not appear at all
    expect(result).not.toContain('Twitter');
    expect(result).not.toContain('LinkedIn');
    expect(result).not.toContain('twitter.com');
    expect(result).not.toContain('linkedin.com');

    // Non-social links should be preserved as markdown links
    expect(result).toContain('[Example](https://example.com)');
    expect(result).toContain('[Docs](https://docs.example.com)');

    // The whole line (including "Regular link:") should be present
    expect(result).toContain('Regular link:');
    expect(result).toContain('Not social:');
  });

  test('small markdown with contact info forms its own chunk if long enough', () => {
    const contactLine = 'Contact: test@example.com';
    const filler = makeMarkdown(120, 'x');
    const input = `${filler}\n${contactLine}`;
    const result = chunkMarkdownForEmbedding(input);
    expect(result.some((chunk) => chunk.includes('test@example.com'))).toBe(true);
  });

  test('does not create chunk for too-short contact info', () => {
    const input = 'Contact: test@example.com'; // Less than MIN_CONTACT_CHUNK
    const result = chunkMarkdownForEmbedding(input);
    expect(result.length).toBe(1);
    expect(result[0]).toContain('test@example.com');
  });

  test('trims and cleans all whitespace', () => {
    const input = '\n\n   \n\nSome text\n\n   \n\n';
    const result = chunkMarkdownForEmbedding(input);
    expect(result.length).toBe(1);
    expect(result[0]).toBe('Some text');
  });

  test('filters out empty chunks after cleaning', () => {
    // Create markdown that will result in some chunks becoming empty after cleanMarkdown
    const input = [
      '# First Section',
      makeMarkdown(600, 'a'), // This will remain
      '# Social Section',
      '[Twitter](https://twitter.com/test)', // This will be removed
      '[LinkedIn](https://linkedin.com/test)', // This will be removed
      '```code block```', // This will be removed
      '   ', // Whitespace only
      '# Third Section',
      makeMarkdown(600, 'c'), // This will remain
    ].join('\n');

    const result = chunkMarkdownForEmbedding(input);

    // Verify no empty chunks are returned
    expect(result.every((chunk) => chunk.trim().length > 0)).toBe(true);

    // Verify we get the expected non-empty chunks
    expect(result.length).toBe(2); // Should only have first and third sections
    expect(result[0]).toMatch(/a{600}/); // First section content
    expect(result[1]).toMatch(/c{600}/); // Third section content

    // Verify social links and code blocks are not present
    expect(result.join('')).not.toContain('Twitter');
    expect(result.join('')).not.toContain('LinkedIn');
    expect(result.join('')).not.toContain('twitter.com');
    expect(result.join('')).not.toContain('code block');
  });

  describe('cleanMarkdown social link filtering', () => {
    test('removes markdown social links but keeps others', () => {
      const input = `
        Regular link: [Example](https://example.com)
        Social link: [Twitter](https://twitter.com/testuser)
        Another social: [LinkedIn](https://linkedin.com/in/test)
        Not social: [Docs](https://docs.example.com)
      `;
      const result = cleanMarkdown(input);
      expect(result).toContain('Regular link: [Example](https://example.com)');
      expect(result).not.toContain('Twitter');
      expect(result).not.toContain('LinkedIn');
      expect(result).toContain('Not social: [Docs](https://docs.example.com)');
    });

    test('removes plain social URLs but keeps non-social ones', () => {
      const input = `
        https://twitter.com/testuser
        https://example.com/page
        https://linkedin.com/in/foobar
      `;
      const result = cleanMarkdown(input);
      expect(result).not.toContain('twitter.com');
      expect(result).not.toContain('linkedin.com');
      expect(result).toContain('https://example.com/page');
    });

    test('filters out lines with just social urls during chunking', () => {
      const input = [
        'Intro text',
        'https://twitter.com/someuser',
        'Normal line',
        'https://linkedin.com/in/foo',
        'Last line',
      ].join('\n');
      const chunks = chunkMarkdownForEmbedding(input);
      expect(chunks.join('\n')).not.toContain('twitter.com');
      expect(chunks.join('\n')).not.toContain('linkedin.com');
      expect(chunks.join('\n')).toContain('Intro text');
      expect(chunks.join('\n')).toContain('Normal line');
      expect(chunks.join('\n')).toContain('Last line');
    });

    test('removes social markdown links even with complex URL formatting', () => {
      const input = '[Github Profile](https://github.com/test-user)';
      const result = cleanMarkdown(input);
      expect(result).not.toContain('Github');
      expect(result).not.toContain('github.com');
    });
  });
});
