import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { FormState } from '../types';

export type PdfResult = {
  blob: Blob;
  base64: string;
  filename: string;
};

const safe = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 30) || 'unnamed';

export function buildPdfFilename(state: FormState): string {
  const groom = safe(state.groom);
  const bride = safe(state.bride);
  const date =
    state.year && state.month && state.day
      ? `${state.year}${state.month.padStart(2, '0')}${state.day.padStart(2, '0')}`
      : new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${groom}_${bride}_${date}.pdf`;
}

export async function generateContractPdf(state: FormState): Promise<PdfResult> {
  const node = document.getElementById('printable-contract') as HTMLElement | null;
  if (!node) throw new Error('printable-contract element not found');

  // 暫時把 absolute 的隱藏元素拉到 viewport 內，避免某些瀏覽器跳過渲染
  const original = { left: node.style.left, top: node.style.top };
  node.style.left = '0px';
  node.style.top = '0px';
  node.style.zIndex = '-1';

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });
  } finally {
    node.style.left = original.left;
    node.style.top = original.top;
    node.style.zIndex = '';
  }

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const usableWidth = pageWidth - margin * 2;

  const imgWidth = usableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

  // 多頁分割：用一個剪裁高度從 source canvas 切片貼到每一頁
  const pageContentHeight = pageHeight - margin * 2;
  const sliceCanvasHeight = (canvas.width * pageContentHeight) / imgWidth;

  if (imgHeight <= pageContentHeight) {
    pdf.addImage(dataUrl, 'JPEG', margin, margin, imgWidth, imgHeight);
  } else {
    let yOffset = 0;
    let first = true;
    while (yOffset < canvas.height) {
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = Math.min(sliceCanvasHeight, canvas.height - yOffset);
      const ctx = sliceCanvas.getContext('2d');
      if (!ctx) throw new Error('canvas 2d ctx failed');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(
        canvas,
        0, yOffset, canvas.width, sliceCanvas.height,
        0, 0, canvas.width, sliceCanvas.height,
      );
      const sliceDataUrl = sliceCanvas.toDataURL('image/jpeg', 0.92);
      const sliceHeight = (sliceCanvas.height * imgWidth) / canvas.width;
      if (!first) pdf.addPage();
      pdf.addImage(sliceDataUrl, 'JPEG', margin, margin, imgWidth, sliceHeight);
      first = false;
      yOffset += sliceCanvas.height;
    }
  }

  const blob = pdf.output('blob') as Blob;
  const dataUriString = pdf.output('datauristring') as string;
  const base64 = dataUriString.split(',')[1] ?? '';
  const filename = buildPdfFilename(state);
  return { blob, base64, filename };
}

