import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { GenerateStoryOutput } from '@/lib/types';
import fs from 'fs';
import path from 'path';

// We need to extend the jsPDF type to include the autoTable method
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export const generateStoryPdf = async (storyData: GenerateStoryOutput) => {
  const doc = new jsPDF() as jsPDFWithAutoTable;

  // Load font from the filesystem
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansSC-Regular.ttf');
  const font = fs.readFileSync(fontPath);
  const fontB64 = font.toString('base64');
  
  doc.addFileToVFS('NotoSansSC-Regular.ttf', fontB64);
  doc.addFont('NotoSansSC-Regular.ttf', 'NotoSansSC', 'normal');

  // Title (using default font)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(18);
  doc.text(storyData.title, 14, 22);

  // Story (using default font)
  doc.setFontSize(12);
  const storyLines = doc.splitTextToSize(storyData.story, 180);
  doc.text(storyLines, 14, 32);

  // Translation
  doc.addPage();
  doc.setFont('NotoSansSC'); // Use the loaded font
  doc.setFontSize(16);
  doc.text('中文译文', 14, 22);
  
  doc.setFontSize(12);
  const translationLines = doc.splitTextToSize(storyData.translation, 180);
  doc.text(translationLines, 14, 32);


  return doc.output('datauristring');
};