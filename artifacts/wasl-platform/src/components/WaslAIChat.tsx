import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Send, Loader2, RotateCcw, Mic, MicOff,
  Sparkles, ChevronRight, Zap, Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

/* ─── styles ─────────────────────────────────────────────────────────────── */
const injectStyles = () => {
  if (document.getElementById('wa2-styles')) return;
  const s = document.createElement('style');
  s.id = 'wa2-styles';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap');
    @keyframes wa-dot    { 0%,100%{opacity:.9} 50%{opacity:.3} }
    @keyframes wa-in     { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:none} }
    @keyframes wa-spin   { to{transform:rotate(360deg)} }
    @keyframes wa-float  { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-6px)} }
    @keyframes wa-pulse  { 0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,.0), -4px 4px 24px rgba(0,0,0,.5)} 50%{box-shadow:0 0 0 8px rgba(99,102,241,.18), -4px 4px 32px rgba(99,102,241,.35)} }
    @keyframes wa-star   { 0%,100%{opacity:0;transform:scale(0) rotate(0deg)} 50%{opacity:1;transform:scale(1) rotate(180deg)} }
    @keyframes wa-wink   { 0%,85%,100%{transform:scaleY(1)} 90%{transform:scaleY(0.1)} }
    .wa-blink  { animation: wa-dot 2s ease-in-out infinite; }
    .wa-in     { animation: wa-in .22s ease both; }
    .wa-spin   { animation: wa-spin .9s linear infinite; }
    .wa-float  { animation: wa-float 2.8s ease-in-out infinite; }
    .wa-pulse  { animation: wa-pulse 2.4s ease-in-out infinite; }
    .wa-star-1 { animation: wa-star 2.2s 0.0s ease-in-out infinite; }
    .wa-star-2 { animation: wa-star 2.2s 0.7s ease-in-out infinite; }
    .wa-star-3 { animation: wa-star 2.2s 1.4s ease-in-out infinite; }
    .wa-wink   { animation: wa-wink 4s 2s ease-in-out infinite; }
    .wa-panel * { box-sizing: border-box; }
    .wa-panel ::-webkit-scrollbar { width: 3px; }
    .wa-panel ::-webkit-scrollbar-track { background: transparent; }
    .wa-panel ::-webkit-scrollbar-thumb { background: rgba(99,102,241,.25); border-radius: 3px; }
    .wa-textarea::placeholder { color: rgba(255,255,255,.25); }
    .wa-panel textarea { font-family: Tajawal, sans-serif; }
    .wa-quick:hover { background: rgba(99,102,241,.12) !important; border-color: rgba(99,102,241,.35) !important; color: rgba(255,255,255,.88) !important; }
    .wa-icon-btn:hover { background: rgba(255,255,255,.07) !important; color: rgba(255,255,255,.8) !important; }
  `;
  document.head.appendChild(s);
};

/* ─── auth fetch ─────────────────────────────────────────────────────────── */
async function authedPost(path: string, body: unknown) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? `HTTP ${res.status}`); }
  return res.json();
}

/* ─── types ──────────────────────────────────────────────────────────────── */
interface Message { role: 'user' | 'assistant'; content: string; isWelcome?: boolean; }

const WELCOME: Message = {
  role: 'assistant', isWelcome: true,
  content: `Hi there! I'm **Wasalawi** — the smart data assistant for the Wasl platform, brought to you by Wasl. How can I help you today?

I have full live access to read and update bank data in real time. I can:

- Generate comprehensive analytical reports
- Update bank statuses and implementation stages
- Track risks and action items
- Manage meetings and responsible parties
- Search and compare banks

What do you need?`,
};

const QUICK = [
  { label: 'Weekly Report',     text: 'Generate a comprehensive weekly report for me' },
  { label: 'High-Risk Banks',   text: 'Show me delayed or high-risk banks' },
  { label: 'Compare Two Banks', text: 'Compare Al Rajhi Bank with Saudi National Bank' },
  { label: 'Overdue Actions',   text: 'Show me overdue action items' },
];

/* ─── markdown ───────────────────────────────────────────────────────────── */
function bold(text: string): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((p, i) =>
    i % 2 === 1 ? <strong key={i} style={{ color: 'white', fontWeight: 600 }}>{p}</strong> : p
  );
}

type MdBlock = { type: 'table'; rows: string[][] } | { type: 'lines'; lines: string[] };

function parseBlocks(text: string): MdBlock[] {
  const lines = text.split('\n');
  const out: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const tr = lines[i].trim();
    if (tr.startsWith('|') && tr.includes('|', 1)) {
      const tl: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { tl.push(lines[i]); i++; }
      const rows = tl
        .filter(l => !/^\|\s*[-:]+[\s|:-]*$/.test(l.trim()))
        .map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
      if (rows.length) out.push({ type: 'table', rows });
    } else {
      const last = out[out.length - 1];
      if (last?.type === 'lines') last.lines.push(lines[i]);
      else out.push({ type: 'lines', lines: [lines[i]] });
      i++;
    }
  }
  return out;
}

const T = {
  h2:  { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'rgba(165,180,252,.85)', marginTop: 14, marginBottom: 3 },
  li:  { fontSize: 13.5, lineHeight: 1.7, color: 'rgba(255,255,255,.78)' },
  num: { fontSize: 11, fontWeight: 700, color: 'rgba(251,191,36,.8)', width: 16, flexShrink: 0, marginTop: 2 },
  dot: { fontSize: 7, color: 'rgba(99,102,241,.65)', flexShrink: 0, marginTop: 6 },
  p:   { fontSize: 13.5, lineHeight: 1.7, color: 'rgba(255,255,255,.78)' },
};

function renderLine(line: string, key: string | number): React.ReactNode {
  if (/^###\s/.test(line)) return <p key={key} style={{ ...T.h2, fontSize: 10, color: 'rgba(148,163,184,.75)', marginTop: 10 }}>{bold(line.replace(/^###\s/, ''))}</p>;
  if (/^##\s/.test(line))  return <p key={key} style={T.h2}>{bold(line.replace(/^##\s/, ''))}</p>;
  if (/^#\s/.test(line))   return <p key={key} style={{ ...T.p, fontSize: 14, fontWeight: 700, color: 'white', marginTop: 8 }}>{bold(line.replace(/^#\s/, ''))}</p>;
  if (/^[•\-\*]\s/.test(line.trim())) return (
    <div key={key} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '1.5px 0' }}>
      <span style={T.dot}>◆</span>
      <span style={T.li}>{bold(line.trim().replace(/^[•\-\*]\s/, ''))}</span>
    </div>
  );
  if (/^\d+\.\s/.test(line.trim())) {
    const n = line.trim().match(/^(\d+)\./)?.[1];
    return (
      <div key={key} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '1.5px 0' }}>
        <span style={T.num}>{n}.</span>
        <span style={T.li}>{bold(line.trim().replace(/^\d+\.\s/, ''))}</span>
      </div>
    );
  }
  if (!line.trim()) return <div key={key} style={{ height: 6 }} />;
  return <p key={key} style={T.p}>{bold(line)}</p>;
}

function Md({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {parseBlocks(text).map((b, bi) => {
        if (b.type === 'table') {
          const [hdr, ...rows] = b.rows;
          return (
            <div key={bi} style={{ overflowX: 'auto', margin: '10px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }} dir="rtl">
                <thead>
                  <tr style={{ background: 'rgba(99,102,241,0.12)' }}>
                    {hdr.map((c, ci) => <th key={ci} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'rgba(255,255,255,.85)', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' }}>{bold(c)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} style={{ background: ri % 2 ? 'rgba(255,255,255,0.025)' : 'transparent' }}>
                      {row.map((c, ci) => <td key={ci} style={{ padding: '7px 12px', textAlign: 'right', color: 'rgba(255,255,255,.68)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{bold(c)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return b.lines.map((l, li) => renderLine(l, `${bi}-${li}`));
      })}
    </div>
  );
}

/* ─── PDF / DOCX export ──────────────────────────────────────────────────── */
// A message is considered a weekly report if it contains any of these markers
// (generated by the وصلاوي weekly-report prompt).
const REPORT_MARKERS = [
  '## 📊 Overview',
  '## 🚨 Banks Needing Urgent Attention',
  '## 📊 نظرة عامة',
  '## نظرة عامة',
  '**التقرير الأسبوعي',
  'التقرير الأسبوعي الشامل',
  '**Report generated on:**',
  '**Weekly Report',
];
function isWeeklyReport(text: string): boolean {
  return REPORT_MARKERS.some(m => text.includes(m));
}

/** Split an emoji prefix from text so it can be isolated from Arabic BiDi context. */
function splitEmoji(text: string): [string, string] {
  // Match one or more emoji characters (+ optional variation selectors / ZWJ) at the start
  const m = text.match(/^((?:\p{Emoji_Presentation}|\p{Extended_Pictographic})[\uFE00-\uFE0F\u200D\u20E3]*\s*)+/u);
  if (m) return [m[0].trimEnd(), text.slice(m[0].length)];
  return ['', text];
}

/** Render a heading tag with the emoji isolated so Arabic BiDi doesn't garble the text. */
function renderHtmlHeading(tag: string, content: string): string {
  const [emoji, rest] = splitEmoji(content);
  const inner = emoji
    ? `<span class="hdr-emoji">${emoji}</span> ${escHtml(rest)}`
    : escHtml(content);
  return `<${tag}>${inner}</${tag}>`;
}

function buildReportHtml(markdown: string): string {
  // Convert markdown to styled HTML for PDF rendering
  const lines = markdown.split('\n');
  let html = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const tr = line.trim();
    // Table block
    if (tr.startsWith('|') && tr.includes('|', 1)) {
      const tl: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { tl.push(lines[i]); i++; }
      const rows = tl
        .filter(l => !/^\|\s*[-:]+[\s|:-]*$/.test(l.trim()))
        .map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
      if (rows.length) {
        const [hdr, ...body] = rows;
        html += `<table><thead><tr>${hdr.map(c => `<th>${escHtml(c)}</th>`).join('')}</tr></thead><tbody>`;
        body.forEach((row, ri) => {
          html += `<tr class="${ri % 2 === 0 ? 'even' : ''}">${row.map(c => `<td>${escHtml(c)}</td>`).join('')}</tr>`;
        });
        html += '</tbody></table>';
      }
      continue;
    }
    // Headings / bullets / paragraphs
    if (/^###\s/.test(line)) {
      html += renderHtmlHeading('h3', line.replace(/^###\s/, ''));
    } else if (/^##\s/.test(line)) {
      html += renderHtmlHeading('h2', line.replace(/^##\s/, ''));
    } else if (/^#\s/.test(line)) {
      html += renderHtmlHeading('h1', line.replace(/^#\s/, ''));
    } else if (/^[•\-\*]\s/.test(tr)) {
      html += `<p class="bullet">◆ ${escHtml(tr.replace(/^[•\-\*]\s/, ''))}</p>`;
    } else if (/^\d+\.\s/.test(tr)) {
      html += `<p class="num">${escHtml(tr)}</p>`;
    } else if (!tr) {
      html += '<div style="height:6px"></div>';
    } else {
      html += `<p>${escHtml(line)}</p>`;
    }
    i++;
  }
  return html;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

async function exportReportAsPdf(markdown: string) {
  const { default: jsPDF } = await import('jspdf');
  const { default: html2canvas } = await import('html2canvas');

  const today = new Date().toISOString().slice(0, 10);

  // Build the off-screen container
  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed', 'top:-9999px', 'left:-9999px',
    'width:794px',       // A4 @ 96dpi ≈ 794px
    'padding:48px 56px',
    'background:#ffffff',
    'font-family:Arial,sans-serif',
    'direction:ltr',
    'text-align:left',
    'color:#1a1a2e',
    'box-sizing:border-box',
    'line-height:1.7',
  ].join(';');

  container.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
      * { box-sizing: border-box; }
      h1 { font-size:20px; font-weight:700; color:#1e3a8a; margin:20px 0 6px; }
      h2 { font-size:13px; font-weight:700; color:#4f46e5; text-transform:uppercase;
           letter-spacing:.07em; margin:18px 0 4px; border-bottom:1px solid #e5e7eb; padding-bottom:4px; }
      h3 { font-size:12px; font-weight:700; color:#374151; margin:12px 0 3px; }
      p  { font-size:13px; color:#374151; margin:3px 0; }
      .hdr-emoji {
        font-family:'Noto Color Emoji','Segoe UI Emoji','Apple Color Emoji',sans-serif;
        unicode-bidi:isolate; display:inline-block; margin-left:4px;
      }
      p.bullet { padding-right:14px; color:#374151; }
      p.num    { padding-right:14px; color:#374151; }
      strong { font-weight:700; color:#111827; }
      table  { width:100%; border-collapse:collapse; margin:12px 0; font-size:12px; }
      th { background:#eef2ff; color:#1e3a8a; font-weight:700; padding:7px 10px;
           border:1px solid #c7d2fe; text-align:left; }
      td { padding:6px 10px; border:1px solid #e5e7eb; color:#374151; text-align:left; }
      tr.even td { background:#f9fafb; }
      .header { display:flex; align-items:center; justify-content:space-between;
                border-bottom:2px solid #4f46e5; padding-bottom:14px; margin-bottom:20px; }
      .logo-text { font-size:24px; font-weight:800; color:#1e3a8a; letter-spacing:.03em; }
      .logo-sub  { font-size:11px; color:#6b7280; margin-top:2px; }
      .date-badge { font-size:11px; color:#6b7280; background:#f3f4f6;
                    border:1px solid #e5e7eb; border-radius:6px; padding:4px 10px; }
      .footer { margin-top:32px; padding-top:12px; border-top:1px solid #e5e7eb;
                font-size:10px; color:#9ca3af; text-align:center; }
    </style>
    <div class="header">
      <div>
        <div class="logo-text">Wasl</div>
        <div class="logo-sub">Banking Product Implementation Tracking Platform</div>
      </div>
      <div class="date-badge">Weekly Report · ${today}</div>
    </div>
    <div id="report-body">${buildReportHtml(markdown)}</div>
    <div class="footer">Generated by Wasalawi — Wasl Platform Smart Assistant · ${today}</div>
  `;

  document.body.appendChild(container);

  // Wait a frame so fonts/styles apply
  await new Promise(r => setTimeout(r, 400));

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW  = pageW;
    const imgH  = (canvas.height * imgW) / canvas.width;

    let y = 0;
    while (y < imgH) {
      if (y > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, -y, imgW, imgH);
      y += pageH;
    }

    pdf.save(`wasl-report-${today}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

/* ─── DOCX export ────────────────────────────────────────────────────────── */
function stripBold(s: string): string { return s.replace(/\*\*(.+?)\*\*/g, '$1'); }

function makeBoldRuns(s: string, baseOpts: Record<string, unknown> = {}): unknown[] {
  // Returns an array of TextRun-compatible option objects (bold toggled)
  const parts = s.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => ({ ...baseOpts, text: p, bold: i % 2 === 1 }));
}

async function exportReportAsDocx(markdown: string) {
  const docx = await import('docx');
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  } = docx;

  const today = new Date().toISOString().slice(0, 10);

  type DocChild = typeof Paragraph.prototype | typeof Table.prototype;
  const children: DocChild[] = [];

  // ── Header paragraph (title) ──
  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    children: [new TextRun({ text: 'وصل — منصة متابعة تنفيذ المنتجات البنكية', bold: true, size: 36, color: '1e3a8a' })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    children: [new TextRun({ text: `التقرير الأسبوعي · ${today}`, size: 20, color: '6b7280' })],
  }));
  children.push(new Paragraph({ children: [] })); // spacer

  // ── Parse markdown ──
  const lines = markdown.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const tr = line.trim();

    // Table block
    if (tr.startsWith('|') && tr.includes('|', 1)) {
      const tl: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { tl.push(lines[i]); i++; }
      const rows = tl
        .filter(l => !/^\|\s*[-:]+[\s|:-]*$/.test(l.trim()))
        .map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
      if (rows.length >= 2) {
        const [hdr, ...body] = rows;
        const colCount = hdr.length;
        const colW = Math.floor(9000 / colCount);
        const tableRows = [
          new TableRow({
            tableHeader: true,
            children: hdr.map(c => new TableCell({
              width: { size: colW, type: WidthType.DXA },
              shading: { type: ShadingType.SOLID, color: 'eef2ff', fill: 'eef2ff' },
              children: [new Paragraph({
                alignment: AlignmentType.RIGHT, bidirectional: true,
                children: [new TextRun({ text: stripBold(c), bold: true, color: '1e3a8a', size: 20 })],
              })],
            })),
          }),
          ...body.map((row, ri) => new TableRow({
            children: row.map(c => new TableCell({
              width: { size: colW, type: WidthType.DXA },
              shading: ri % 2 === 0
                ? { type: ShadingType.SOLID, color: 'f9fafb', fill: 'f9fafb' }
                : { type: ShadingType.CLEAR, color: 'ffffff', fill: 'ffffff' },
              children: [new Paragraph({
                alignment: AlignmentType.RIGHT, bidirectional: true,
                children: makeBoldRuns(c, { size: 20, color: '374151' }) as InstanceType<typeof TextRun>[],
              })],
            })),
          })),
        ];
        children.push(new Table({
          width: { size: 9000, type: WidthType.DXA },
          rows: tableRows,
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 4, color: 'e5e7eb' },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: 'e5e7eb' },
            left:   { style: BorderStyle.SINGLE, size: 4, color: 'e5e7eb' },
            right:  { style: BorderStyle.SINGLE, size: 4, color: 'e5e7eb' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'e5e7eb' },
            insideVertical:   { style: BorderStyle.SINGLE, size: 4, color: 'e5e7eb' },
          },
        }));
        children.push(new Paragraph({ children: [] })); // spacer after table
      }
      continue;
    }

    if (/^###\s/.test(line)) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        alignment: AlignmentType.RIGHT, bidirectional: true,
        children: [new TextRun({ text: stripBold(line.replace(/^###\s/, '')), bold: true, color: '374151', size: 22 })],
      }));
    } else if (/^##\s/.test(line)) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.RIGHT, bidirectional: true,
        children: [new TextRun({ text: stripBold(line.replace(/^##\s/, '')), bold: true, color: '4f46e5', size: 24 })],
      }));
    } else if (/^#\s/.test(line)) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.RIGHT, bidirectional: true,
        children: [new TextRun({ text: stripBold(line.replace(/^#\s/, '')), bold: true, color: '1e3a8a', size: 28 })],
      }));
    } else if (/^[•\-\*]\s/.test(tr)) {
      children.push(new Paragraph({
        alignment: AlignmentType.RIGHT, bidirectional: true,
        bullet: { level: 0 },
        children: makeBoldRuns(tr.replace(/^[•\-\*]\s/, ''), { size: 22, color: '374151' }) as InstanceType<typeof TextRun>[],
      }));
    } else if (/^\d+\.\s/.test(tr)) {
      children.push(new Paragraph({
        alignment: AlignmentType.RIGHT, bidirectional: true,
        numbering: { reference: 'numbered-list', level: 0 },
        children: makeBoldRuns(tr.replace(/^\d+\.\s/, ''), { size: 22, color: '374151' }) as InstanceType<typeof TextRun>[],
      }));
    } else if (!tr) {
      children.push(new Paragraph({ children: [] }));
    } else {
      children.push(new Paragraph({
        alignment: AlignmentType.RIGHT, bidirectional: true,
        children: makeBoldRuns(line, { size: 22, color: '374151' }) as InstanceType<typeof TextRun>[],
      }));
    }
    i++;
  }

  // ── Footer ──
  children.push(new Paragraph({ children: [] }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER, bidirectional: true,
    children: [new TextRun({ text: `Generated by Wasalawi — Wasl Platform Smart Assistant · ${today}`, size: 16, color: '9ca3af' })],
  }));

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'numbered-list',
        levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.RIGHT }],
      }],
    },
    sections: [{
      properties: {},
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `wasl-report-${today}.docx`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ─── speech ─────────────────────────────────────────────────────────────── */
const SpeechAPI = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

/* ─── sub-components ─────────────────────────────────────────────────────── */
function Avatar({ sm }: { sm?: boolean }) {
  const d = sm ? 28 : 36;
  return (
    <div style={{
      width: d, height: d, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(140deg,#1e3a8a,#4c1d95)',
      border: '2px solid rgba(99,102,241,.45)',
      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Anime-style SVG avatar */}
      <svg width={d} height={d} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* background */}
        <rect width="36" height="36" fill="url(#ag)" />
        <defs>
          <linearGradient id="ag" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1e3a8a"/>
            <stop offset="1" stopColor="#4c1d95"/>
          </linearGradient>
        </defs>
        {/* hair */}
        <ellipse cx="18" cy="11" rx="9" ry="8" fill="#4338ca"/>
        <rect x="9" y="10" width="18" height="6" fill="#4338ca"/>
        {/* hair bangs */}
        <ellipse cx="12" cy="13" rx="3.5" ry="3" fill="#3730a3"/>
        <ellipse cx="24" cy="13" rx="3.5" ry="3" fill="#3730a3"/>
        {/* face */}
        <ellipse cx="18" cy="18" rx="8" ry="8.5" fill="#fde8d8"/>
        {/* left eye */}
        <ellipse cx="14.5" cy="17" rx="2.2" ry="2.6" fill="white"/>
        <ellipse cx="14.5" cy="17.3" rx="1.5" ry="1.9" fill="#1e3a8a"/>
        <ellipse cx="14.5" cy="17.3" rx="0.8" ry="1" fill="#0f172a"/>
        <ellipse cx="15.1" cy="16.6" rx="0.45" ry="0.45" fill="white"/>
        {/* right eye */}
        <ellipse cx="21.5" cy="17" rx="2.2" ry="2.6" fill="white"/>
        <ellipse cx="21.5" cy="17.3" rx="1.5" ry="1.9" fill="#1e3a8a"/>
        <ellipse cx="21.5" cy="17.3" rx="0.8" ry="1" fill="#0f172a"/>
        <ellipse cx="22.1" cy="16.6" rx="0.45" ry="0.45" fill="white"/>
        {/* blush */}
        <ellipse cx="12" cy="20" rx="1.8" ry="0.9" fill="#fca5a5" opacity="0.55"/>
        <ellipse cx="24" cy="20" rx="1.8" ry="0.9" fill="#fca5a5" opacity="0.55"/>
        {/* smile */}
        <path d="M15 21.5 Q18 23.5 21 21.5" stroke="#e11d48" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
        {/* collar / body suggestion */}
        <path d="M10 34 Q14 28 18 27 Q22 28 26 34" fill="#4f46e5"/>
        {/* sparkle */}
        <circle cx="29" cy="7" r="1" fill="#a5b4fc" opacity="0.8"/>
        <circle cx="6" cy="8" r="0.7" fill="#c4b5fd" opacity="0.7"/>
      </svg>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="wa-in" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', justifyContent: 'flex-start' }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,.09)',
        fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.45)',
        fontFamily: 'Tajawal,sans-serif',
      }}>أ</div>
      <div style={{
        maxWidth: '80%', padding: '9px 13px', borderRadius: '4px 14px 14px 14px',
        background: 'rgba(99,102,241,.13)', border: '1px solid rgba(99,102,241,.22)',
        fontFamily: 'Tajawal,sans-serif',
      }}>
        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'rgba(255,255,255,.85)', margin: 0 }} dir="auto">{text}</p>
      </div>
    </div>
  );
}

function AiBubble({ msg }: { msg: Message }) {
  const hasTable = msg.content.includes('|');
  const showExport = isWeeklyReport(msg.content);
  const [exportingPdf,  setExportingPdf]  = React.useState(false);
  const [exportingDocx, setExportingDocx] = React.useState(false);

  async function handlePdf() {
    if (exportingPdf) return;
    setExportingPdf(true);
    try { await exportReportAsPdf(msg.content); }
    catch (e) { console.error('PDF export failed', e); }
    finally { setExportingPdf(false); }
  }

  async function handleDocx() {
    if (exportingDocx) return;
    setExportingDocx(true);
    try { await exportReportAsDocx(msg.content); }
    catch (e) { console.error('DOCX export failed', e); }
    finally { setExportingDocx(false); }
  }

  const busy = exportingPdf || exportingDocx;

  return (
    <div className="wa-in" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', justifyContent: 'flex-end' }}>
      <div style={{
        width: hasTable ? 'calc(100% - 46px)' : undefined,
        maxWidth: hasTable ? undefined : '88%',
        padding: '11px 14px', borderRadius: '14px 4px 14px 14px',
        background: 'transparent',
        borderRight: '2px solid rgba(99,102,241,.35)',
        fontFamily: 'Tajawal,sans-serif',
        minWidth: 0, overflow: 'hidden',
      }} dir="ltr">
        <Md text={msg.content} />

        {showExport && (
          <div style={{ marginTop: 10, display: 'flex', gap: 7, justifyContent: 'flex-start' }}>
            {/* PDF */}
            <button
              onClick={handlePdf}
              disabled={busy}
              title="Export report as PDF"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11.5, fontWeight: 600, fontFamily: 'Tajawal,sans-serif',
                padding: '5px 11px', borderRadius: 8,
                background: exportingPdf ? 'rgba(99,102,241,.07)' : 'rgba(99,102,241,.12)',
                border: '1px solid rgba(99,102,241,.28)',
                color: busy ? 'rgba(165,180,252,.4)' : 'rgba(165,180,252,.85)',
                cursor: busy ? 'default' : 'pointer', transition: 'all .15s',
              }}
            >
              {exportingPdf
                ? <Loader2 style={{ width: 11, height: 11, animation: 'wa-spin .9s linear infinite' }} />
                : <Download style={{ width: 11, height: 11 }} />}
              {exportingPdf ? 'Loading…' : 'PDF'}
            </button>

            {/* Word */}
            <button
              onClick={handleDocx}
              disabled={busy}
              title="Export report as Word"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11.5, fontWeight: 600, fontFamily: 'Tajawal,sans-serif',
                padding: '5px 11px', borderRadius: 8,
                background: exportingDocx ? 'rgba(16,185,129,.07)' : 'rgba(16,185,129,.1)',
                border: '1px solid rgba(16,185,129,.28)',
                color: busy ? 'rgba(110,231,183,.35)' : 'rgba(110,231,183,.85)',
                cursor: busy ? 'default' : 'pointer', transition: 'all .15s',
              }}
            >
              {exportingDocx
                ? <Loader2 style={{ width: 11, height: 11, animation: 'wa-spin .9s linear infinite' }} />
                : <Download style={{ width: 11, height: 11 }} />}
              {exportingDocx ? 'Loading…' : 'Word'}
            </button>
          </div>
        )}
      </div>
      <Avatar sm />
    </div>
  );
}

function Dots() {
  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', justifyContent: 'flex-end' }}>
      <div style={{
        padding: '13px 16px', borderRadius: '14px 4px 14px 14px',
        borderRight: '2px solid rgba(99,102,241,.3)',
        display: 'flex', gap: 5, alignItems: 'center',
      }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: '50%', background: 'rgba(165,180,252,.5)',
            animation: `wa-dot 1s ${i*.2}s ease-in-out infinite`,
          }} />
        ))}
      </div>
      <Avatar sm />
    </div>
  );
}

/* ─── trigger button ─────────────────────────────────────────────────────── */
function Trigger({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      transition={{ type: 'spring', damping: 22 }}
      onClick={onClick}
      title="Wasalawi — Smart Assistant"
      style={{
        position: 'fixed', bottom: 32, right: 0, zIndex: 40,
        display: 'flex', alignItems: 'center',
        padding: 0, border: 'none', cursor: 'pointer', background: 'transparent',
      }}
    >
      {/* Floating avatar tab */}
      <div className="wa-float" style={{ position: 'relative' }}>
        {/* Sparkle stars */}
        <span className="wa-star-1" style={{
          position: 'absolute', top: -6, left: 2, fontSize: 10, pointerEvents: 'none',
        }}>✦</span>
        <span className="wa-star-2" style={{
          position: 'absolute', top: 4, left: -6, fontSize: 8, pointerEvents: 'none', color: '#a5b4fc',
        }}>★</span>
        <span className="wa-star-3" style={{
          position: 'absolute', bottom: 0, left: 0, fontSize: 7, pointerEvents: 'none', color: '#c4b5fd',
        }}>✦</span>

        {/* Tab backing */}
        <div className="wa-pulse" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 6,
          width: 48, paddingBlock: 12,
          background: 'linear-gradient(160deg,#0d1526 0%,#1a1040 100%)',
          border: '1px solid rgba(99,102,241,.4)',
          borderRight: 'none',
          borderRadius: '14px 0 0 14px',
        }}>
          {/* Anime avatar — bigger, winking right eye */}
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(140deg,#1e3a8a,#4c1d95)',
            border: '2px solid rgba(165,180,252,.55)',
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="36" height="36" fill="url(#tg)"/>
              <defs>
                <linearGradient id="tg" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#1e3a8a"/>
                  <stop offset="1" stopColor="#4c1d95"/>
                </linearGradient>
              </defs>
              {/* hair */}
              <ellipse cx="18" cy="11" rx="9" ry="8" fill="#4338ca"/>
              <rect x="9" y="10" width="18" height="6" fill="#4338ca"/>
              <ellipse cx="12" cy="13" rx="3.5" ry="3" fill="#3730a3"/>
              <ellipse cx="24" cy="13" rx="3.5" ry="3" fill="#3730a3"/>
              {/* face */}
              <ellipse cx="18" cy="18" rx="8" ry="8.5" fill="#fde8d8"/>
              {/* left eye (normal) */}
              <ellipse cx="14.5" cy="17" rx="2.2" ry="2.6" fill="white"/>
              <ellipse cx="14.5" cy="17.3" rx="1.5" ry="1.9" fill="#1e3a8a"/>
              <ellipse cx="14.5" cy="17.3" rx="0.8" ry="1" fill="#0f172a"/>
              <ellipse cx="15.1" cy="16.6" rx="0.45" ry="0.45" fill="white"/>
              {/* right eye (winking animation) */}
              <g className="wa-wink" style={{ transformOrigin: '21.5px 17px' }}>
                <ellipse cx="21.5" cy="17" rx="2.2" ry="2.6" fill="white"/>
                <ellipse cx="21.5" cy="17.3" rx="1.5" ry="1.9" fill="#1e3a8a"/>
                <ellipse cx="21.5" cy="17.3" rx="0.8" ry="1" fill="#0f172a"/>
                <ellipse cx="22.1" cy="16.6" rx="0.45" ry="0.45" fill="white"/>
              </g>
              {/* blush */}
              <ellipse cx="12" cy="20" rx="1.8" ry="0.9" fill="#fca5a5" opacity="0.6"/>
              <ellipse cx="24" cy="20" rx="1.8" ry="0.9" fill="#fca5a5" opacity="0.6"/>
              {/* big smile */}
              <path d="M14.5 21.8 Q18 24.2 21.5 21.8" stroke="#e11d48" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
              {/* body */}
              <path d="M10 36 Q14 28 18 27 Q22 28 26 36" fill="#4f46e5"/>
            </svg>
          </div>

          {/* Label */}
          <span style={{
            fontSize: 8.5, fontWeight: 800, color: 'rgba(165,180,252,.75)',
            writingMode: 'vertical-lr', transform: 'rotate(180deg)',
            fontFamily: 'system-ui,sans-serif', letterSpacing: '.1em',
            textTransform: 'uppercase',
          }}>AI</span>

          <ChevronRight style={{ width: 11, height: 11, color: 'rgba(165,180,252,.4)' }} />
        </div>
      </div>
    </motion.button>
  );
}

/* ─── main ───────────────────────────────────────────────────────────────── */
export function WaslAIChat() {
  useEffect(() => { injectStyles(); }, []);

  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState<Message[]>([WELCOME]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError]   = useState<string | null>(null);
  const [showQuick, setShowQuick] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const recRef    = useRef<any>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 300); }, [open]);

  function grow(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  function startMic() {
    if (!SpeechAPI) { setMicError('المتصفح لا يدعم التعرف على الصوت'); return; }
    setMicError(null);
    const r = new SpeechAPI();
    r.lang = 'ar-SA'; r.interimResults = false;
    r.onstart  = () => setListening(true);
    r.onresult = (e: any) => { setListening(false); const t = e.results[0][0].transcript.trim(); if (t) send(t); };
    r.onerror  = (e: any) => { setListening(false); if (e.error === 'not-allowed') setMicError('يرجى السماح بالوصول للميكروفون'); };
    r.onend    = () => setListening(false);
    recRef.current = r; r.start();
  }
  function stopMic() { recRef.current?.stop(); setListening(false); }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setShowQuick(false);
    const userMsg: Message = { role: 'user', content };
    const hist = messages.filter(m => !m.isWelcome).concat(userMsg).slice(-12).map(({ role, content }) => ({ role, content }));
    setMessages(p => [...p, userMsg]);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setLoading(true);
    try {
      const data = await authedPost('/api/ai/chat', { messages: hist });
      setMessages(p => [...p, { role: 'assistant', content: data.reply ?? data.error ?? 'حدث خطأ.' }]);
    } catch (err: any) {
      const msg = err?.message && !err.message.startsWith('HTTP ') ? err.message : 'تعذّر الاتصال، يرجى المحاولة مجدداً.';
      setMessages(p => [...p, { role: 'assistant', content: msg }]);
    } finally { setLoading(false); }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }
  function reset() { stopMic(); setMessages([WELCOME]); setInput(''); setMicError(null); setShowQuick(true); }

  const canSend = !!input.trim() && !loading;
  const W = 400; // panel width

  return (
    <>
      {/* Trigger tab */}
      <AnimatePresence>{!open && <Trigger onClick={() => setOpen(true)} />}</AnimatePresence>

      {/* Backdrop (mobile only) */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)',
            }}
            className="md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Side panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            dir="ltr"
            className="wa-panel"
            initial={{ x: W }} animate={{ x: 0 }} exit={{ x: W }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: `min(${W}px, 100vw)`,
              zIndex: 50,
              display: 'flex', flexDirection: 'column',
              background: '#080f1c',
              borderLeft: '1px solid rgba(99,102,241,.18)',
              boxShadow: '-20px 0 60px rgba(0,0,0,.55)',
              fontFamily: 'Tajawal, sans-serif',
            }}
          >
            {/* ── header ─────────────────────────────────────────────────── */}
            <div style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 16px',
              borderBottom: '1px solid rgba(255,255,255,.07)',
              background: 'rgba(255,255,255,.02)',
            }}>
              <Avatar />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>Wasalawi</span>
                  <span className="wa-blink" style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 10.5, color: 'rgba(165,180,252,.55)', fontWeight: 500 }}>
                    {listening ? 'Listening…' : 'Connected · Live Data'}
                  </span>
                </div>
                <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,.3)', margin: 0, marginTop: 1 }}>
                  Wasl Platform Smart Assistant
                </p>
              </div>

              {/* model badge */}
              <div style={{
                fontSize: 9.5, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.22)',
                color: 'rgba(165,180,252,.7)', letterSpacing: '.04em',
              }}>GPT-4o</div>

              <button className="wa-icon-btn" onClick={reset} title="New conversation" style={{
                width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'transparent', color: 'rgba(255,255,255,.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background .15s, color .15s',
              }}>
                <RotateCcw style={{ width: 13, height: 13 }} />
              </button>
              <button className="wa-icon-btn" onClick={() => setOpen(false)} title="Close" style={{
                width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'transparent', color: 'rgba(255,255,255,.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background .15s, color .15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,.1)'; (e.currentTarget as HTMLElement).style.color = '#fca5a5'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.28)'; }}
              >
                <X style={{ width: 15, height: 15 }} />
              </button>
            </div>

            {/* ── context strip ──────────────────────────────────────────── */}
            <div style={{
              flexShrink: 0, padding: '7px 16px',
              borderBottom: '1px solid rgba(255,255,255,.05)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Sparkles style={{ width: 11, height: 11, color: 'rgba(165,180,252,.45)', flexShrink: 0 }} />
              <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,.28)' }}>
                Live access to banks · meetings · risks · action items
              </span>
            </div>

            {/* ── messages ───────────────────────────────────────────────── */}
            <div style={{
              flex: 1, overflowY: 'auto',
              padding: '20px 16px 8px',
              display: 'flex', flexDirection: 'column', gap: 18,
            }}>
              {messages.map((msg, i) =>
                msg.role === 'user'
                  ? <UserBubble key={i} text={msg.content} />
                  : <AiBubble key={i} msg={msg} />
              )}

              {/* quick chips */}
              {showQuick && !loading && messages.length === 1 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'flex-end', paddingTop: 6 }}>
                  <p style={{ width: '100%', textAlign: 'left', fontSize: 10.5, color: 'rgba(255,255,255,.28)', marginBottom: 2 }}>Quick suggestions</p>
                  {QUICK.map(q => (
                    <button key={q.text} className="wa-quick" onClick={() => send(q.text)} style={{
                      fontSize: 12, padding: '6px 13px', borderRadius: 8,
                      background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)',
                      color: 'rgba(255,255,255,.58)', cursor: 'pointer',
                      fontFamily: 'Tajawal,sans-serif', transition: 'all .15s',
                    }}>
                      {q.label}
                    </button>
                  ))}
                </div>
              )}

              {loading && <Dots />}
              <div ref={bottomRef} />
            </div>

            {/* ── mic overlay ─────────────────────────────────────────────── */}
            <AnimatePresence>
              {listening && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute', inset: '0 0 80px', zIndex: 10,
                    background: 'rgba(8,15,28,.95)', backdropFilter: 'blur(10px)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18,
                  }}
                >
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%',
                    background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Mic style={{ width: 22, height: 22, color: '#fca5a5' }} />
                  </div>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', fontFamily: 'Tajawal,sans-serif' }}>Listening to you now…</p>
                  <button onClick={stopMic} style={{
                    fontSize: 12, color: '#fca5a5', background: 'none', border: '1px solid rgba(239,68,68,.25)',
                    padding: '6px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Tajawal,sans-serif',
                  }}>Stop</button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── input area ──────────────────────────────────────────────── */}
            <div style={{
              flexShrink: 0, padding: '12px 14px 16px',
              borderTop: '1px solid rgba(255,255,255,.07)',
              background: 'rgba(4,8,18,.7)',
            }}>
              {/* mic error */}
              {micError && (
                <div style={{
                  marginBottom: 8, padding: '7px 12px', borderRadius: 8,
                  background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.15)',
                  fontSize: 12, color: '#fca5a5', fontFamily: 'Tajawal,sans-serif', textAlign: 'center',
                }}>
                  {micError}
                </div>
              )}

              {/* input box */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                padding: '12px 14px', borderRadius: 14,
                background: 'rgba(255,255,255,.035)',
                border: '1px solid rgba(255,255,255,.09)',
                transition: 'border-color .2s',
              }}
                onFocusCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,.4)'}
                onBlurCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.09)'}
              >
                <textarea
                  ref={inputRef}
                  className="wa-textarea"
                  value={input}
                  onChange={e => { setInput(e.target.value); grow(e.target); }}
                  onKeyDown={onKey}
                  placeholder="Type your message to Wasalawi…"
                  rows={1}
                  disabled={loading || listening}
                  dir="auto"
                  style={{
                    width: '100%', background: 'transparent', border: 'none', outline: 'none',
                    resize: 'none', fontSize: 14, color: 'white',
                    minHeight: 24, maxHeight: 140,
                    fontFamily: 'Tajawal,sans-serif', caretColor: '#818cf8',
                    opacity: loading || listening ? 0.4 : 1,
                    lineHeight: 1.6,
                  }}
                />

                {/* actions row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', fontFamily: 'Tajawal,sans-serif' }}>
                    Enter to send · Shift+Enter for new line
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!!SpeechAPI && (
                      <button onClick={listening ? stopMic : startMic} disabled={loading} style={{
                        width: 32, height: 32, borderRadius: 9, border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: listening ? 'rgba(239,68,68,.15)' : 'rgba(255,255,255,.05)',
                        color: listening ? '#fca5a5' : 'rgba(255,255,255,.38)',
                        transition: 'background .15s, color .15s',
                        opacity: loading ? 0.35 : 1,
                      }}>
                        {listening ? <MicOff style={{ width: 13, height: 13 }} /> : <Mic style={{ width: 13, height: 13 }} />}
                      </button>
                    )}

                    <button onClick={() => send()} disabled={!canSend} style={{
                      height: 32, padding: '0 14px', borderRadius: 9, border: 'none', cursor: canSend ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: canSend ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'rgba(255,255,255,.05)',
                      color: canSend ? 'white' : 'rgba(255,255,255,.25)',
                      fontSize: 12, fontWeight: 600, fontFamily: 'Tajawal,sans-serif',
                      transition: 'background .2s, color .2s',
                      boxShadow: canSend ? '0 0 18px rgba(99,102,241,.4)' : 'none',
                    }}>
                      {loading
                        ? <Loader2 className="wa-spin" style={{ width: 13, height: 13 }} />
                        : <><Send style={{ width: 13, height: 13 }} /><span>Send</span></>
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
