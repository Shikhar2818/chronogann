import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function exportElementAsPng(elementId: string, filename: string): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error('Export target not found');

  const canvas = await html2canvas(el, {
    backgroundColor: '#0a0a0f',
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const link = document.createElement('a');
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export async function exportElementAsPdf(elementId: string, filename: string): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error('Export target not found');

  const canvas = await html2canvas(el, {
    backgroundColor: '#0a0a0f',
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  pdf.setFillColor(10, 10, 15);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  pdf.setTextColor(0, 212, 255);
  pdf.setFontSize(14);
  pdf.text('ChronoGann — Gann Time-Cycle Research', margin, 28);
  pdf.setTextColor(180, 180, 190);
  pdf.setFontSize(9);
  pdf.text(new Date().toLocaleString(), margin, 40);

  let y = 52;
  let remaining = imgHeight;

  while (remaining > 0) {
    const sliceHeight = Math.min(remaining, pageHeight - y - margin);
    const sourceY = imgHeight - remaining;
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = (sliceHeight / imgWidth) * canvas.width;
    const ctx = sliceCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        canvas,
        0,
        (sourceY / imgHeight) * canvas.height,
        canvas.width,
        sliceCanvas.height,
        0,
        0,
        canvas.width,
        sliceCanvas.height
      );
      pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, y, imgWidth, sliceHeight);
    }
    remaining -= sliceHeight;
    if (remaining > 0) {
      pdf.addPage();
      y = margin;
    }
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
