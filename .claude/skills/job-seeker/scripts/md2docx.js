// Convert the CV / cover-letter markdown subset (#, ##, ###, "- " bullets, **bold**) to .docx.
// Usage: node tools/md2docx.js <in.md> <out.docx>
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, LevelFormat, AlignmentType, BorderStyle } = require('docx');

const [, , src, out] = process.argv;
if (!src || !out) { console.error('usage: node tools/md2docx.js <in.md> <out.docx>'); process.exit(1); }

const FONT = 'Calibri';
// "**bold** text" -> TextRuns
const runs = (text) => text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((t) =>
  t.startsWith('**') ? new TextRun({ text: t.slice(2, -2), bold: true }) : new TextRun(t));

const children = [];
let first = true;
for (const raw of fs.readFileSync(src, 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line) continue;
  let m;
  if ((m = line.match(/^# (.*)/))) children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: runs(m[1]) }));
  else if ((m = line.match(/^## (.*)/))) children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs(m[1]) }));
  else if ((m = line.match(/^### (.*)/))) children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs(m[1]) }));
  else if ((m = line.match(/^[-*] (.*)/))) children.push(new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: runs(m[1]) }));
  else children.push(new Paragraph({ children: runs(line) }));
  first = false;
}
if (first) { console.error('empty input'); process.exit(1); }

const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 21 }, paragraph: { spacing: { after: 80 } } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: FONT, size: 40, bold: true, color: '1F3864' }, paragraph: { spacing: { before: 0, after: 60 }, keepNext: true } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', run: { font: FONT, size: 26, bold: true, color: '1F3864' },
        paragraph: { spacing: { before: 240, after: 100 }, keepNext: true, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1F3864', space: 2 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', run: { font: FONT, size: 22, bold: true }, paragraph: { spacing: { before: 160, after: 40 }, keepNext: true } },
    ],
  },
  numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] }] },
  sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log('wrote ' + out); });
