// Generates the two deliverables for a timesheet export: a branded PDF
// (styled after the IT depends offering documents — logo, near-black/gray
// palette, thin dividers) and a zip of the attachments logged against the
// exported entries. Both run entirely client-side: the app already holds
// the full customers/projects/entries in memory, and attachment bytes are
// fetched directly from Azure Blob Storage via the existing short-lived SAS
// download URLs (see lib/store.ts), so no new backend endpoint is needed.

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { PDFFont, PDFPage } from 'pdf-lib';
import JSZip from 'jszip';

import type { AttachmentRef, Customer, Entry, Project } from '../types';
import { fmtEUR, fmtH } from './format';
import { rateForDate } from './rates';
import { fmtShortDateYear, parseISO } from './dates';
import * as store from './store';
import logoUrl from '../assets/itdepends-logo.png';

const INK = rgb(0x1a / 255, 0x1a / 255, 0x1a / 255);
const GRAY = rgb(0x88 / 255, 0x88 / 255, 0x88 / 255);
const DIVIDER = rgb(0xdd / 255, 0xdd / 255, 0xdd / 255);
const HEADER_BG = rgb(0xf5 / 255, 0xf5 / 255, 0xf5 / 255);

const PAGE_WIDTH = 595.28; // A4 in points
const PAGE_HEIGHT = 841.89;
const MARGIN = 56.7; // ~2cm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export interface TimesheetExportEntry {
  entry: Entry;
  project: Project;
  customer: Customer;
}

export interface TimesheetExportOptions {
  scopeLabel: string; // e.g. "Acme Corp" or "Acme Corp — Website Redesign"
  periodLabel: string; // e.g. "June 2026"
  hoursPerDay: number;
  entries: TimesheetExportEntry[];
}

let cachedLogoBytes: ArrayBuffer | null = null;

async function loadLogoBytes(): Promise<ArrayBuffer> {
  if (!cachedLogoBytes) {
    const response = await fetch(logoUrl);
    cachedLogoBytes = await response.arrayBuffer();
  }
  return cachedLogoBytes;
}

function attachmentCount(entries: TimesheetExportEntry[]): number {
  return entries.reduce((sum, item) => sum + item.entry.attachments.length, 0);
}

// Draws wrapped text within `maxWidth`, returning the number of lines used.
function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  color = INK,
  lineHeight = size * 1.35,
): number {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) {
    lines.push(current);
  }

  lines.forEach((line, index) => {
    page.drawText(line, { x, y: y - index * lineHeight, size, font, color });
  });

  return lines.length || 1;
}

export async function buildTimesheetPdf(options: TimesheetExportOptions): Promise<Uint8Array> {
  const { scopeLabel, periodLabel, hoursPerDay, entries } = options;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const logo = await doc.embedPng(await loadLogoBytes());

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };

  // ── header: logo left, company info right ──
  const logoSize = 42;
  page.drawImage(logo, { x: MARGIN, y: y - logoSize, width: logoSize, height: logoSize });

  const companyLines = ['IT depends', 'Fabiolalaan 27, 3290 Diest, België', 'BE1029640449'];
  companyLines.forEach((line, index) => {
    const size = 9;
    const width = font.widthOfTextAtSize(line, size);
    page.drawText(line, { x: MARGIN + CONTENT_WIDTH - width, y: y - 6 - index * 12, size, font, color: GRAY });
  });

  y -= logoSize + 30;

  // ── title ──
  page.drawText('Timesheet', { x: MARGIN, y, size: 24, font: bold, color: INK });
  y -= 34;

  // ── metadata block ──
  page.drawText('CLIENT', { x: MARGIN, y, size: 9, font, color: GRAY });
  page.drawText('PERIOD', { x: MARGIN + CONTENT_WIDTH / 2, y, size: 9, font, color: GRAY });
  y -= 15;
  page.drawText(scopeLabel, { x: MARGIN, y, size: 12, font: bold, color: INK });
  page.drawText(periodLabel, { x: MARGIN + CONTENT_WIDTH / 2, y, size: 12, font: bold, color: INK });
  y -= 12;
  page.drawText(`Generated on ${fmtShortDateYear(new Date())}`, { x: MARGIN, y, size: 9, font, color: GRAY });
  y -= 20;

  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_WIDTH, y }, thickness: 0.75, color: DIVIDER });
  y -= 22;

  // ── table ──
  const columns = [
    { key: 'date', label: 'Date', x: MARGIN, width: 90 },
    { key: 'duration', label: 'Duration', x: MARGIN + 90, width: 70 },
    { key: 'comment', label: 'Comment', x: MARGIN + 160, width: CONTENT_WIDTH - 160 - 90, },
    { key: 'amount', label: 'Amount', x: MARGIN + CONTENT_WIDTH - 90, width: 90 },
  ];

  const drawTableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 6, width: CONTENT_WIDTH, height: 20, color: HEADER_BG });
    columns.forEach((column) => {
      page.drawText(column.label, { x: column.x + 4, y: y, size: 9, font: bold, color: INK });
    });
    y -= 26;
  };

  drawTableHeader();

  const sorted = entries.slice().sort((a, b) => a.entry.date.localeCompare(b.entry.date));
  let totalMinutes = 0;

  sorted.forEach(({ entry, project }) => {
    const minutes = entry.end - entry.start;
    const amount = ((minutes / 60) / hoursPerDay) * rateForDate(project.rates, entry.date);
    totalMinutes += minutes;

    const rowTop = y;
    page.drawText(fmtShortDateYear(parseISO(entry.date)), { x: columns[0].x + 4, y: rowTop, size: 10, font, color: INK });
    page.drawText(fmtH(minutes), { x: columns[1].x + 4, y: rowTop, size: 10, font, color: INK });
    const commentLines = entry.comment
      ? drawWrapped(page, entry.comment, columns[2].x + 4, rowTop, columns[2].width - 8, font, 10)
      : 1;
    const amountText = fmtEUR(amount);
    const amountWidth = font.widthOfTextAtSize(amountText, 10);
    page.drawText(amountText, { x: columns[3].x + columns[3].width - 4 - amountWidth, y: rowTop, size: 10, font, color: INK });

    const rowHeight = Math.max(18, commentLines * 13.5);
    y -= rowHeight;

    page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: MARGIN + CONTENT_WIDTH, y: y + 6 }, thickness: 0.5, color: DIVIDER });
    y -= 6;

    if (y < MARGIN + 100) {
      newPage();
      drawTableHeader();
    }
  });

  y -= 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_WIDTH, y }, thickness: 1, color: INK });
  y -= 22;

  const totalHoursText = `Total hours: ${fmtH(totalMinutes)}`;
  page.drawText(totalHoursText, { x: MARGIN, y, size: 11, font: bold, color: INK });

  const count = attachmentCount(entries);
  if (count > 0) {
    const attachmentsText = `Attachments: ${count} (see accompanying zip)`;
    const width = font.widthOfTextAtSize(attachmentsText, 10);
    page.drawText(attachmentsText, { x: MARGIN + CONTENT_WIDTH - width, y, size: 10, font, color: GRAY });
  }
  y -= 30;

  page.drawText(
    'This document lists the hours logged for the period above and is provided as supporting detail for the corresponding invoice.',
    { x: MARGIN, y, size: 9, font: italic, color: GRAY },
  );

  // ── footer ──
  const footerY = MARGIN - 10;
  page.drawLine({ start: { x: MARGIN, y: footerY + 14 }, end: { x: MARGIN + CONTENT_WIDTH, y: footerY + 14 }, thickness: 0.75, color: DIVIDER });
  const footerText = 'IT depends  ·  BE1029640449  ·  Fabiolalaan 27, 3290 Diest';
  const footerWidth = font.widthOfTextAtSize(footerText, 8);
  page.drawText(footerText, { x: MARGIN + (CONTENT_WIDTH - footerWidth) / 2, y: footerY, size: 8, font, color: GRAY });

  return doc.save();
}

// Fetches every attachment logged against `entries` directly from Blob
// Storage (via the existing per-attachment SAS download endpoint) and bundles
// them into a single zip for download. Requires the storage account's CORS
// rules to allow GET from the app's origin (see AGENTS.md).
export async function buildAttachmentsZip(entries: TimesheetExportEntry[]): Promise<Blob | null> {
  const zip = new JSZip();
  const usedNames = new Set<string>();
  let added = 0;

  for (const { entry } of entries) {
    for (const attachment of entry.attachments as AttachmentRef[]) {
      const downloadUrl = await store.getAttachmentDownloadUrl(entry.id, attachment.id);
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        continue;
      }
      const bytes = await response.arrayBuffer();

      let name = `${entry.date}_${attachment.fileName}`;
      let suffix = 1;
      while (usedNames.has(name)) {
        suffix += 1;
        name = `${entry.date}_${suffix}_${attachment.fileName}`;
      }
      usedNames.add(name);

      zip.file(name, bytes);
      added += 1;
    }
  }

  if (added === 0) {
    return null;
  }

  return zip.generateAsync({ type: 'blob' });
}

export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
