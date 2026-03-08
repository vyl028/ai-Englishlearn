import zlib from 'node:zlib';
import { strFromU8, unzipSync } from 'fflate';

function decodeXmlEntities(raw: string) {
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function normalizeWhitespace(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function extractTextFromTxtLike(buffer: Buffer) {
  // Try UTF-8 first; fallback to UTF-16LE (common on Windows).
  const utf8 = buffer.toString('utf8');
  const replacementCount = (utf8.match(/\uFFFD/g) || []).length;
  if (replacementCount > 10) {
    return normalizeWhitespace(buffer.toString('utf16le'));
  }
  return normalizeWhitespace(utf8);
}

export function extractTextFromDocx(buffer: Buffer) {
  const files = unzipSync(new Uint8Array(buffer));
  const doc = files['word/document.xml'];
  if (!doc) throw new Error('DOCX 解析失败：未找到 word/document.xml');

  const xml = strFromU8(doc);
  const text = xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '');

  return normalizeWhitespace(decodeXmlEntities(text));
}

function decodePdfLiteralStringContent(content: string) {
  let out = '';
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }

    i++;
    if (i >= content.length) break;
    const next = content[i];

    switch (next) {
      case 'n':
        out += '\n';
        break;
      case 'r':
        out += '\r';
        break;
      case 't':
        out += '\t';
        break;
      case 'b':
        out += '\b';
        break;
      case 'f':
        out += '\f';
        break;
      case '(':
      case ')':
      case '\\':
        out += next;
        break;
      case '\n':
        // Line continuation (ignore)
        break;
      case '\r':
        // Line continuation (ignore), optional \n
        if (content[i + 1] === '\n') i++;
        break;
      default: {
        if (/[0-7]/.test(next)) {
          let oct = next;
          let count = 0;
          while (count < 2 && i + 1 < content.length && /[0-7]/.test(content[i + 1])) {
            oct += content[i + 1];
            i++;
            count++;
          }
          out += String.fromCharCode(parseInt(oct, 8));
        } else {
          out += next;
        }
      }
    }
  }
  return out;
}

function extractPdfLiteralStrings(source: string) {
  const results: string[] = [];
  const re = /\((?:\\.|[^\\)])*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const token = m[0];
    const inner = token.slice(1, -1);
    const decoded = decodePdfLiteralStringContent(inner);
    results.push(decoded);
  }
  return results;
}

function isLikelyEnglishText(text: string) {
  const trimmed = text.trim();
  if (trimmed.length < 30) return false;
  const letters = (trimmed.match(/[A-Za-z]/g) || []).length;
  return letters / Math.max(1, trimmed.length) > 0.2;
}

export function extractTextFromPdf(buffer: Buffer) {
  const latin1 = buffer.toString('latin1');
  const warnings: string[] = [];
  if (!latin1.startsWith('%PDF')) {
    warnings.push('文件可能不是标准 PDF（缺少 %PDF 头）。');
  }

  // Best-effort extraction without extra dependencies:
  // - Find (possibly flate-compressed) content streams
  // - Inflate when /FlateDecode is present
  // - Extract literal strings (...) from content streams
  const sources: string[] = [];
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  let match: RegExpExecArray | null;
  let streamCount = 0;
  while ((match = streamRe.exec(latin1)) && streamCount < 200) {
    streamCount++;
    const content = match[1] || '';
    const contentOffset = match[0].indexOf(content);
    if (contentOffset < 0) continue;

    const contentStart = match.index + contentOffset;
    const contentEnd = contentStart + content.length;

    const dictSnippet = latin1.substring(Math.max(0, match.index - 300), match.index);
    const hasFlate = /\/FlateDecode\b/.test(dictSnippet);

    let raw = buffer.subarray(contentStart, contentEnd);
    // Trim trailing EOL that often precedes endstream.
    if (raw.length > 0 && raw[raw.length - 1] === 0x0a) raw = raw.subarray(0, raw.length - 1);
    if (raw.length > 0 && raw[raw.length - 1] === 0x0d) raw = raw.subarray(0, raw.length - 1);

    if (hasFlate) {
      try {
        const inflated = zlib.inflateSync(raw);
        sources.push(inflated.toString('latin1'));
        continue;
      } catch {
        // fallthrough to raw
      }
    }

    // Some PDFs keep content streams uncompressed.
    if (raw.length > 0) sources.push(raw.toString('latin1'));
  }

  // Fallback: scan the full file content if no stream found.
  if (sources.length === 0) sources.push(latin1);

  const tokens: string[] = [];
  for (const src of sources) {
    const parts = extractPdfLiteralStrings(src);
    for (const p of parts) {
      const cleaned = p.replace(/\u0000/g, '').trim();
      if (!cleaned) continue;
      // Filter out obvious non-text noise.
      if (!/[A-Za-z]/.test(cleaned)) continue;
      tokens.push(cleaned);
    }
  }

  const combined = normalizeWhitespace(tokens.join(' '));
  if (!combined) throw new Error('PDF 解析失败：未提取到可用文本。');
  if (!isLikelyEnglishText(combined)) {
    warnings.push('PDF 提取结果可能不完整（可能是扫描版/字体编码特殊）。建议复制粘贴正文或使用可编辑文本文件。');
  }

  return { text: combined, warnings };
}

