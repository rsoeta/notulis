import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { normalizeLogoCandidates } from '../components/common/KopLogo';
import { formatDateIndo, formatMeetingDocFilename } from './formatters';

function noBorders() {
  return {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };
}

function buildInfoRow(label, value, boldValue = false) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 28, type: WidthType.PERCENTAGE },
        borders: noBorders(),
        children: [
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: label, bold: false, font: 'Times New Roman', size: 22 }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 4, type: WidthType.PERCENTAGE },
        borders: noBorders(),
        children: [
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: ':', bold: false, font: 'Times New Roman', size: 22 }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 68, type: WidthType.PERCENTAGE },
        borders: noBorders(),
        children: [
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: String(value || '-'),
                bold: boldValue,
                font: 'Times New Roman',
                size: 22,
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function tableCellText(text, bold = false, shaded = false, align = AlignmentType.LEFT) {
  return new TableCell({
    shading: shaded ? { fill: 'F1F5F9', type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text: String(text || '-'),
            bold,
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      }),
    ],
  });
}

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 220, after: 100 },
    children: [
      new TextRun({
        text,
        bold: true,
        font: 'Times New Roman',
        size: 23,
      }),
    ],
  });
}

async function resolveImageDataForDocx(logoUrl) {
  const candidates = normalizeLogoCandidates(logoUrl);
  if (candidates.length === 0) return null;

  for (const src of candidates) {
    try {
      let bytes;
      let type = 'png';

      if (src.startsWith('data:image/')) {
        const mimePart = src.slice(5, src.indexOf(';')).toLowerCase();
        if (mimePart.includes('jpeg') || mimePart.includes('jpg')) type = 'jpg';
        else if (mimePart.includes('gif')) type = 'gif';
        else if (mimePart.includes('bmp')) type = 'bmp';

        const base64 = src.split(',')[1] || '';
        const bin = atob(base64);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
          bytes[i] = bin.charCodeAt(i);
        }
      } else {
        const resp = await fetch(src, { referrerPolicy: 'no-referrer' });
        if (!resp.ok) continue;
        const contentType = (resp.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('jpeg') || contentType.includes('jpg')) type = 'jpg';
        bytes = new Uint8Array(await resp.arrayBuffer());
      }

      if (bytes && bytes.length > 0) {
        return { bytes, type };
      }
    } catch {
      // Coba kandidat URL berikutnya
    }
  }

  return null;
}

export async function downloadMeetingDocxClient(meeting) {
  const kop = meeting.kop;
  const children = [];

  if (kop) {
    const contactLine = [kop.address, kop.phone].filter(Boolean).join(' · ');
    const logoImg = await resolveImageDataForDocx(kop.logo_drive_url);

    const kopLineSpecs = [];
    if (kop.header_line_1) {
      kopLineSpecs.push({ text: kop.header_line_1.toUpperCase(), bold: true, size: 23 });
    }
    if (kop.header_line_2) {
      kopLineSpecs.push({ text: kop.header_line_2.toUpperCase(), bold: true, size: 24 });
    }
    if (kop.institution_name) {
      kopLineSpecs.push({ text: kop.institution_name.toUpperCase(), bold: true, size: 28 });
    }
    if (contactLine) {
      kopLineSpecs.push({ text: contactLine, bold: false, size: 19 });
    }

    const toParagraph = (spec, withBottomBorder = false) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: withBottomBorder ? { after: 120 } : undefined,
        border: withBottomBorder
          ? { bottom: { style: BorderStyle.DOUBLE, size: 12, color: '0F172A' } }
          : undefined,
        children: [
          new TextRun({
            text: spec.text,
            bold: spec.bold,
            font: 'Times New Roman',
            size: spec.size,
          }),
        ],
      });

    if (logoImg) {
      const kopTextParagraphs = kopLineSpecs.map((spec) => toParagraph(spec, false));
      const bottomDouble = { style: BorderStyle.DOUBLE, size: 12, color: '0F172A' };
      const cellBorders = {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: bottomDouble,
      };
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 16, type: WidthType.PERCENTAGE },
                  verticalAlign: VerticalAlign.CENTER,
                  borders: cellBorders,
                  margins: { bottom: 120 },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new ImageRun({
                          type: logoImg.type,
                          data: logoImg.bytes,
                          transformation: { width: 62, height: 62 },
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 84, type: WidthType.PERCENTAGE },
                  verticalAlign: VerticalAlign.CENTER,
                  borders: cellBorders,
                  margins: { bottom: 120 },
                  children: kopTextParagraphs.length > 0 ? kopTextParagraphs : [new Paragraph('')],
                }),
              ],
            }),
          ],
        })
      );
    } else {
      kopLineSpecs.forEach((spec, idx) => {
        children.push(toParagraph(spec, idx === kopLineSpecs.length - 1));
      });
    }
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 40 },
      children: [
        new TextRun({
          text: (meeting.doc_type_title || 'NOTULEN RAPAT').toUpperCase(),
          bold: true,
          font: 'Times New Roman',
          size: 26,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `Nomor: ${meeting.doc_number || '-'}`,
          bold: false,
          font: 'Times New Roman',
          size: 21,
        }),
      ],
    })
  );

  // I. Pelaksanaan Rapat
  children.push(sectionHeading('I. PELAKSANAAN RAPAT'));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        buildInfoRow('Agenda / Judul', meeting.title, true),
        buildInfoRow('Hari / Tanggal', formatDateIndo(meeting.meeting_date), false),
        buildInfoRow('Waktu', meeting.time_range || '-', false),
        buildInfoRow('Tempat', meeting.location || '-', false),
        buildInfoRow(
          'Jumlah Peserta',
          `${meeting.participant_count || meeting.participants?.length || 0} orang`,
          false
        ),
      ],
    })
  );

  // II. Daftar Hadir
  children.push(sectionHeading('II. DAFTAR HADIR PESERTA'));
  const participants = meeting.participants || [];
  if (participants.length > 0) {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              tableCellText('No', true, true, AlignmentType.CENTER),
              tableCellText('Nama Lengkap', true, true),
              tableCellText('Jabatan / Unsur', true, true),
              tableCellText('Status', true, true, AlignmentType.CENTER),
            ],
          }),
          ...participants.map(
            (p, idx) =>
              new TableRow({
                children: [
                  tableCellText(idx + 1, false, false, AlignmentType.CENTER),
                  tableCellText(p.name, false),
                  tableCellText(p.position || '-', false),
                  tableCellText(p.attendance_status || 'HADIR', false, false, AlignmentType.CENTER),
                ],
              })
          ),
        ],
      })
    );
  } else {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Daftar hadir terlampir.', bold: false, font: 'Times New Roman', size: 22 }),
        ],
      })
    );
  }

  // III. Pembahasan
  children.push(sectionHeading('III. PEMBAHASAN'));
  children.push(
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: meeting.summary?.pembahasan || '-',
          bold: false,
          font: 'Times New Roman',
          size: 22,
        }),
      ],
    })
  );

  // IV. Keputusan
  children.push(sectionHeading('IV. KEPUTUSAN RAPAT'));
  const keputusan = meeting.summary?.keputusan || [];
  if (keputusan.length > 0) {
    keputusan.forEach((k, idx) => {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          indent: { left: 320, hanging: 240 },
          children: [
            new TextRun({ text: `${idx + 1}. ${k}`, bold: false, font: 'Times New Roman', size: 22 }),
          ],
        })
      );
    });
  } else {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: '-', bold: false, font: 'Times New Roman', size: 22 })],
      })
    );
  }

  // V. Tindak Lanjut
  children.push(sectionHeading('V. TINDAK LANJUT'));
  const actions = meeting.action_items || [];
  if (actions.length > 0) {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              tableCellText('No', true, true, AlignmentType.CENTER),
              tableCellText('Uraian Tindak Lanjut', true, true),
              tableCellText('Penanggung Jawab', true, true),
              tableCellText('Batas Waktu', true, true),
            ],
          }),
          ...actions.map(
            (a, idx) =>
              new TableRow({
                children: [
                  tableCellText(a.order_no || idx + 1, false, false, AlignmentType.CENTER),
                  tableCellText(a.description, false),
                  tableCellText(a.pic_name, false),
                  tableCellText(a.deadline, false),
                ],
              })
          ),
        ],
      })
    );
  } else {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Tidak ada tindak lanjut khusus.',
            bold: false,
            font: 'Times New Roman',
            size: 22,
          }),
        ],
      })
    );
  }

  // Signature block
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 420, after: 720 },
      children: [
        new TextRun({
          text: `${formatDateIndo(meeting.meeting_date).split(', ').slice(1).join('')}\nNotulis Rapat,`,
          bold: false,
          font: 'Times New Roman',
          size: 21,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: '___________________________',
          font: 'Times New Roman',
          size: 21,
          bold: true,
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, right: 900, bottom: 900, left: 1080 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileBaseName = formatMeetingDocFilename(meeting);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileBaseName}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
