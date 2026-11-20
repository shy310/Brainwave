/** A real PDF: one page per entry; null makes a page with no text (like a scan). */
export const makePdf = (pages: (string | null)[], { name = 'calculus-notes.pdf', padBytes = 0 } = {}) => {
  const objs: string[] = [];
  const add = (body: string) => { objs.push(body); return objs.length; };
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pagesId = objs.length + 1 + pages.length * 2;
  const kids: number[] = [];
  for (const text of pages) {
    const stream = text ? `BT /F1 16 Tf 72 720 Td (${text}) Tj ET` : '0 0 1 rg 100 400 200 100 re f';
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${content} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`));
  }
  add(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`);
  const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  // Padding (a PDF comment) makes a file of any size for the size-limit tests.
  let out = `%PDF-1.4\n${padBytes ? `%${'x'.repeat(padBytes)}\n` : ''}`;
  const offsets: number[] = [];
  objs.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return { name, mimeType: 'application/pdf', buffer: Buffer.from(out, 'latin1') };
};

