import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
} from 'docx';

interface ParsedBlock {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'code' | 'quote' | 'hr';
  level?: number;
  text?: string;
  items?: string[];
  rows?: string[][];
  ordered?: boolean;
}

function parseMarkdown(md: string): ParsedBlock[] {
  const lines = md.split('\n');
  const blocks: ParsedBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trim().startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }

    // Table
    if (line.includes('|') && line.trim().startsWith('|')) {
      const cells = line.split('|').slice(1, -1);
      if (cells.length > 0 && i + 1 < lines.length && /^\|[\s\-:|]+\|$/.test(lines[i + 1].trim())) {
        const rows: string[][] = [cells.map((c) => c.trim())];
        i += 2;
        while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
          rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
          i++;
        }
        blocks.push({ type: 'table', rows });
        continue;
      }
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
      i++;
      continue;
    }

    // Blockquote
    if (line.trim().startsWith('>')) {
      blocks.push({ type: 'quote', text: line.trim().slice(1).trim() });
      i++;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (olMatch) {
      const items: string[] = [olMatch[2]];
      i++;
      while (i < lines.length) {
        const m = lines[i].match(/^\s*(\d+)\.\s+(.*)$/);
        if (!m) break;
        items.push(m[2]);
        i++;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (ulMatch) {
      const items: string[] = [ulMatch[1]];
      i++;
      while (i < lines.length) {
        const m = lines[i].match(/^\s*[-*]\s+(.*)$/);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph
    blocks.push({ type: 'paragraph', text: line });
    i++;
  }

  return blocks;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
}

export function generateDocx(markdown: string): Promise<Blob> {
  const blocks = parseMarkdown(markdown);
  const children: (Paragraph | Table)[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const level = block.level ?? 1;
        const headingLevel =
          level === 1 ? HeadingLevel.HEADING_1 :
          level === 2 ? HeadingLevel.HEADING_2 :
          level === 3 ? HeadingLevel.HEADING_3 :
          HeadingLevel.HEADING_4;
        children.push(
          new Paragraph({
            heading: headingLevel,
            children: [new TextRun({ text: stripMarkdown(block.text ?? ''), bold: true })],
          })
        );
        break;
      }
      case 'paragraph': {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: stripMarkdown(block.text ?? '') })],
          })
        );
        break;
      }
      case 'list': {
        for (const item of block.items ?? []) {
          children.push(
            new Paragraph({
              text: stripMarkdown(item),
              bullet: block.ordered ? undefined : { level: 0 },
              numbering: block.ordered ? undefined : undefined,
            })
          );
        }
        break;
      }
      case 'table': {
        const rows = block.rows ?? [];
        const tableRows = rows.map((row, rowIdx) => {
          return new TableRow({
            children: row.map((cell) => {
              return new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: stripMarkdown(cell), bold: rowIdx === 0 })],
                  }),
                ],
              });
            }),
          });
        });
        children.push(
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
        break;
      }
      case 'code': {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: block.text ?? '', font: 'Courier New', size: 20 })],
          })
        );
        break;
      }
      case 'quote': {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: stripMarkdown(block.text ?? ''), italics: true })],
            indent: { left: 720 },
          })
        );
        break;
      }
      case 'hr': {
        children.push(
          new Paragraph({
            children: [],
            border: { bottom: { color: '999999', size: 6, style: 'single', space: 1 } },
          })
        );
        break;
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
