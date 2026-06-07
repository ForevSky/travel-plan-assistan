export interface TableData {
  headers: string[];
  rows: string[][];
}

const MD_TABLE_BLOCK_RE =
  /(?:^|\n)(\|[^\n]+\|\n\|[-:| ]+\|\n(?:\|[^\n]+\|\n?)+)/g;

function isSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.includes("-") &&
    /^[\|\s\-:]+$/.test(trimmed) &&
    trimmed.replace(/[\|\s\-:]/g, "").length === 0
  );
}

function parseRow(line: string): string[] {
  const trimmed = line.trim();
  if (trimmed.includes("|")) {
    return trimmed
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
  }
  return trimmed.split(/\s{2,}|\t+/).map((c) => c.trim());
}

function isPipeRow(line: string): boolean {
  return line.includes("|") && parseRow(line).filter(Boolean).length >= 2;
}

/** 扫描连续含 | 的行，识别伪表格块 */
function findPseudoTableBlocks(content: string): Array<{ start: number; end: number; text: string }> {
  const blocks: Array<{ start: number; end: number; text: string }> = [];
  const lines = content.split("\n");
  let lineStart = 0;
  let blockStart = -1;
  let blockLines: string[] = [];

  const flush = (lineEnd: number) => {
    if (blockLines.length >= 2) {
      const text = blockLines.join("\n");
      blocks.push({ start: blockStart, end: lineEnd, text });
    }
    blockStart = -1;
    blockLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const pos = lineStart;

    if (isPipeRow(line)) {
      if (blockStart < 0) blockStart = pos;
      blockLines.push(line);
    } else {
      if (blockStart >= 0) flush(pos);
    }
    lineStart += line.length + 1;
  }
  if (blockStart >= 0) flush(content.length);
  return blocks;
}

export function splitMarkdownSegments(content: string): Array<
  | { type: "text"; value: string }
  | { type: "table"; value: string }
> {
  const segments: Array<
    { type: "text"; value: string } | { type: "table"; value: string }
  > = [];
  const tableRanges: Array<{ start: number; end: number; text: string }> = [];

  MD_TABLE_BLOCK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MD_TABLE_BLOCK_RE.exec(content)) !== null) {
    const start = match.index + (match[0].startsWith("\n") ? 1 : 0);
    tableRanges.push({ start, end: match.index + match[0].length, text: match[1].trim() });
  }

  for (const block of findPseudoTableBlocks(content)) {
    const overlaps = tableRanges.some(
      (r) => block.start < r.end && block.end > r.start
    );
    if (!overlaps) {
      tableRanges.push(block);
    }
  }

  tableRanges.sort((a, b) => a.start - b.start);

  let lastIndex = 0;
  for (const range of tableRanges) {
    if (range.start > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, range.start) });
    }
    segments.push({ type: "table", value: range.text });
    lastIndex = range.end;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  if (segments.length === 0) {
    segments.push({ type: "text", value: content });
  }

  return segments;
}

export function parseMarkdownTable(markdown: string): TableData | null {
  const lines = markdown
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return null;

  let headerLine = 0;
  let dataStart = 1;

  if (lines.length >= 3 && isSeparatorLine(lines[1])) {
    headerLine = 0;
    dataStart = 2;
  }

  const headers = parseRow(lines[headerLine]).filter(Boolean);
  if (headers.length < 2) return null;

  const rows = lines
    .slice(dataStart)
    .filter((l) => !isSeparatorLine(l))
    .map(parseRow)
    .filter((r) => r.some(Boolean));

  if (!rows.length) return null;
  return { headers, rows };
}
