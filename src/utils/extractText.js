import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Use CDN worker to avoid Vite bundling issues
let workerInitialised = false;
function initWorker() {
  if (workerInitialised) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  workerInitialised = true;
}

export async function extractText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ arrayBuffer });
    if (!result.value || result.value.trim().length < 50) {
      throw new Error('Could not extract text from the DOCX file. It may be empty or corrupted.');
    }
    console.log('DOCX extracted text (first 500 chars):', result.value.substring(0, 500));
    return result.value;
  }

  if (ext === 'pdf') {
    initWorker();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(' '));
    }
    const text = pages.join('\n');
    if (!text || text.trim().length < 50) {
      throw new Error('Could not extract text from the PDF. It may be scanned or image-based.');
    }
    console.log('PDF extracted text (first 500 chars):', text.substring(0, 500));
    return text;
  }

  throw new Error('Unsupported file type. Please upload a PDF or DOCX file.');
}
