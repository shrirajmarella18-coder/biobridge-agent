/**
 * Lightweight markdown-to-HTML renderer for assistant messages.
 * Supports: headings (h1-h4), bold, italic, inline code, code blocks,
 * ordered/unordered lists, tables, blockquotes, horizontal rules, links, paragraphs.
 * Escapes HTML first to prevent XSS.
 */

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function renderInline(text: string): string {
  let result = escapeHtml(text);
  // Inline code
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic (avoid matching bold markers)
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  // Links [text](url)
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return result;
}

export function renderMarkdown(md: string): string {
  const lines = md.split('\n');
  const html: string[] = [];
  let i = 0;
  let inList: 'ul' | 'ol' | null = null;
  let tableBuffer: string[][] | null = null;

  function closeList() {
    if (inList) {
      html.push(`</${inList}>`);
      inList = null;
    }
  }

  function flushTable() {
    if (!tableBuffer) return;
    html.push('<table>');
    const [header, ...rows] = tableBuffer;
    html.push('<thead><tr>');
    for (const cell of header) {
      html.push(`<th>${renderInline(cell.trim())}</th>`);
    }
    html.push('</tr></thead><tbody>');
    for (const row of rows) {
      html.push('<tr>');
      for (const cell of row) {
        html.push(`<td>${renderInline(cell.trim())}</td>`);
      }
      html.push('</tr>');
    }
    html.push('</tbody></table>');
    tableBuffer = null;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trim().startsWith('```')) {
      closeList();
      flushTable();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    // Table
    if (line.includes('|') && line.trim().startsWith('|')) {
      const cells = line.split('|').slice(1, -1);
      if (cells.length > 0) {
        // Check if next line is separator
        if (i + 1 < lines.length && /^\|[\s\-:|]+\|$/.test(lines[i + 1].trim())) {
          closeList();
          if (!tableBuffer) tableBuffer = [];
          tableBuffer.push(cells);
          i++; // skip separator
          continue;
        }
        // continuation or standalone table row
        if (tableBuffer) {
          tableBuffer.push(cells);
          i++;
          continue;
        }
      }
    }

    // If we were in a table and this line isn't a table row, flush
    if (tableBuffer && !line.includes('|')) {
      flushTable();
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      closeList();
      flushTable();
      html.push('<hr />');
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      flushTable();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote
    if (line.trim().startsWith('>')) {
      closeList();
      flushTable();
      const content = line.trim().slice(1).trim();
      html.push(`<blockquote>${renderInline(content)}</blockquote>`);
      i++;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (olMatch) {
      flushTable();
      if (inList !== 'ol') {
        closeList();
        html.push('<ol>');
        inList = 'ol';
      }
      html.push(`<li>${renderInline(olMatch[2])}</li>`);
      i++;
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (ulMatch) {
      flushTable();
      if (inList !== 'ul') {
        closeList();
        html.push('<ul>');
        inList = 'ul';
      }
      html.push(`<li>${renderInline(ulMatch[1])}</li>`);
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      closeList();
      flushTable();
      i++;
      continue;
    }

    // Paragraph
    closeList();
    flushTable();
    html.push(`<p>${renderInline(line)}</p>`);
    i++;
  }

  closeList();
  flushTable();

  return html.join('\n');
}
