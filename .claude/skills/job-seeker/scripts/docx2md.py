# Convert a .docx to simple markdown (headings, bullets, paragraphs). Usage: python tools/docx2md.py <in.docx> > out.md
import sys, zipfile, xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding="utf-8")
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
root = ET.fromstring(zipfile.ZipFile(sys.argv[1]).read('word/document.xml'))
for p in root.iter(W + 'p'):
    style = p.find(f'{W}pPr/{W}pStyle')
    s = style.get(W + 'val') if style is not None else ''
    t = ''.join(x.text or '' for x in p.iter(W + 't')).strip()
    if not t: continue
    if s.startswith('Heading') or s == 'Title': t = '#' * (int(s[-1]) + 1 if s[-1].isdigit() else 1) + ' ' + t
    elif p.find(f'{W}pPr/{W}numPr') is not None: t = '- ' + t
    print(t + '\n')
