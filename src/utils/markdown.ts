import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import type { MarkedExtension } from 'marked';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const terminalRenderer = markedTerminal({ width: 80, text: ' ' } as any) as unknown as MarkedExtension;

const marked = new Marked(terminalRenderer);

export function renderMarkdown(text: string): string {
  try {
    const result = marked.parse(text);
    if (typeof result === 'string') return result;
    return text;
  } catch {
    return text;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function mdToTelegram(text: string): string {
  let out = text;

  const codeBlocks: string[] = [];
  out = out.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const placeholder = `__CODEBLOCK_${codeBlocks.length}__`;
    codeBlocks.push(`<pre><code class="${lang}">${escapeHtml(code)}</code></pre>`);
    return placeholder;
  });

  const inlineCodes: string[] = [];
  out = out.replace(/`([^`]+)`/g, (_match, code) => {
    const placeholder = `__INLINECODE_${inlineCodes.length}__`;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return placeholder;
  });

  const links: string[] = [];
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    const placeholder = `__LINK_${links.length}__`;
    links.push(`<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`);
    return placeholder;
  });

  out = escapeHtml(out);

  out = out.replace(/^### (.+)$/gm, '<b><i>$1</i></b>');
  out = out.replace(/^## (.+)$/gm, '<b>$1</b>');
  out = out.replace(/^# (.+)$/gm, '<b>$1</b>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<i>$1</i>');
  out = out.replace(/~~([^~]+)~~/g, '<s>$1</s>');

  for (let i = 0; i < inlineCodes.length; i++) {
    out = out.replace(`__INLINECODE_${i}__`, inlineCodes[i]);
  }
  for (let i = 0; i < codeBlocks.length; i++) {
    out = out.replace(`__CODEBLOCK_${i}__`, codeBlocks[i]);
  }
  for (let i = 0; i < links.length; i++) {
    out = out.replace(`__LINK_${i}__`, links[i]);
  }

  if (out.length > 4096) {
    out = out.slice(0, 4090) + '...';
  }

  return out;
}