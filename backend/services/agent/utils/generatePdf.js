import PDFDocument from "pdfkit";

const C = {
  primary: "#172554",
  accent: "#2563EB",
  light: "#EFF6FF",
  text: "#334155",
  muted: "#64748B",
  border: "#E2E8F0",
  background: "#F8FAFC",
  white: "#FFFFFF",
  purple: "#7C3AED",
  green: "#059669",
  orange: "#D97706",
};

const MARGIN = 52;
const FONT = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
};

const HEADING_GAP = 26; // space above each section heading

const str = (value, fallback = "") =>
  value == null ? fallback : String(value);

const num = (value) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
};

const generatePdf = async (data = {}) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: {
          top: 65,
          bottom: 62,
          left: MARGIN,
          right: MARGIN,
        },
        bufferPages: true,
        info: {
          Author: "NoBound AI",
          Creator: "NoBound AI",
          Title: data.title || "Generated Document",
          Subject: data.subtitle || "AI Generated Document",
        },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("error", reject);
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const W = doc.page.width;
      const H = doc.page.height;
      const CW = W - MARGIN * 2;
      const BOTTOM = () => H - doc.page.margins.bottom;
      const atTop = () => doc.y <= doc.page.margins.top + 2;

      const line = (x1, y1, x2, y2, color = C.border, width = 1) => {
        doc.save();
        doc
          .moveTo(x1, y1)
          .lineTo(x2, y2)
          .lineWidth(width)
          .strokeColor(color)
          .stroke();
        doc.restore();
      };

      const box = (
        x, y, w, h,
        fill = C.white,
        stroke = C.border,
        radius = 8,
      ) => {
        doc.save();
        doc
          .roundedRect(x, y, w, h, radius)
          .fillAndStroke(fill, stroke);
        doc.restore();
      };

      // Adds a page only if the content doesn't fit AND we're not already
      // at the top of a page (prevents blank pages).
      const ensureSpace = (height) => {
        if (!atTop() && doc.y + height + 4 > BOTTOM()) {
          doc.addPage();
          return true;
        }
        return false;
      };

      // Supports **bold** text inside paragraphs.
      const richText = (value, x, y, options = {}) => {
        const parts = str(value)
          .replace(/\r\n/g, "\n")
          .split(/(\*\*[\s\S]+?\*\*)/g);

        const width = options.width ?? CW;
        const fontSize = options.fontSize ?? 10.5;
        const lineGap = options.lineGap ?? 3;

        doc.fontSize(fontSize).fillColor(options.color || C.text);

        let first = true;

        for (const part of parts) {
          if (!part) continue;

          const bold =
            part.startsWith("**") && part.endsWith("**");

          const content = bold ? part.slice(2, -2) : part;

          doc
            .font(bold ? FONT.bold : FONT.regular)
            .text(
              content,
              first ? x : undefined,
              first ? y : undefined,
              {
                width,
                lineGap,
                continued: true,
                align: options.align || "left",
              },
            );

          first = false;
        }

        if (first) {
          doc.text("", x, y, { width });
        } else {
          doc.text("", { continued: false });
        }
      };

      const paragraphHeight = (text, options = {}) => {
        const width = options.width ?? CW;
        const fontSize = options.fontSize ?? 10.5;
        const lineGap = options.lineGap ?? 3.5;
        doc.font(FONT.regular).fontSize(fontSize);
        return doc.heightOfString(text.replace(/\*\*/g, ""), {
          width,
          lineGap,
        });
      };

      const paragraph = (value, options = {}) => {
        const text = str(value).trim();
        if (!text) return;

        const x = options.x ?? MARGIN;
        const width = options.width ?? CW;
        const fontSize = options.fontSize ?? 10.5;
        const lineGap = options.lineGap ?? 3.5;

        const height = paragraphHeight(text, { width, fontSize, lineGap });

        ensureSpace(height + 10);

        const y = doc.y;

        richText(text, x, y, { width, fontSize, lineGap });

        doc.y = y + height + (options.gap ?? 8);
      };

      const bullet = (value, index, ordered = false) => {
        const text = str(value)
          .replace(/^\s*[-•]\s*/, "")
          .replace(/^\s*\d+[.)]\s*/, "")
          .trim();

        if (!text) return;

        const markerWidth = 20;
        const width = CW - markerWidth;

        doc.font(FONT.regular).fontSize(10.5);
        const height = doc.heightOfString(text.replace(/\*\*/g, ""), {
          width,
          lineGap: 3,
        });

        ensureSpace(height + 8);
        const y = doc.y;

        doc
          .font(FONT.bold)
          .fontSize(9.5)
          .fillColor(C.accent)
          .text(
            ordered ? `${index + 1}.` : "•",
            MARGIN + 2,
            y,
            { width: markerWidth - 3 },
          );

        richText(text, MARGIN + markerWidth, y, {
          width,
          fontSize: 10.5,
          lineGap: 3,
        });

        doc.y = y + height + 7;
      };

      // keepWith = minimum space that must fit under the heading,
      // so a heading is never left alone at the bottom of a page.
      const sectionHeading = (heading, keepWith = 60) => {
        doc.font(FONT.bold).fontSize(15);

        const height = doc.heightOfString(heading, {
          width: CW - 18,
          lineGap: 2,
        });

        const gap = atTop() ? 0 : HEADING_GAP;
        const needed = gap + height + 32 + keepWith;

        if (!atTop() && doc.y + needed > BOTTOM()) {
          doc.addPage(); // new page: no extra gap needed
        } else {
          doc.y += gap;
        }

        const y = doc.y;

        doc.save();
        doc
          .roundedRect(MARGIN, y - 4, 4, Math.max(18, height), 2)
          .fill(C.accent);
        doc.restore();

        doc
          .font(FONT.bold)
          .fontSize(15)
          .fillColor(C.primary)
          .text(heading, MARGIN + 14, y, {
            width: CW - 14,
            lineGap: 2,
          });

        doc.moveDown(0.4);
        line(MARGIN + 14, doc.y, W - MARGIN, doc.y);
        doc.moveDown(0.7);
      };

      // Estimates how much room the first block of a section needs.
      const firstBlockHeight = (section) => {
        const content = Array.isArray(section.content) ? section.content : [];
        const first = content.map((c) => str(c).trim()).find(Boolean);

        if (first) {
          const clean = first
            .replace(/^\s*[-•]\s*/, "")
            .replace(/^\s*\d+[.)]\s*/, "");
          // Need at least the first couple of lines.
          return Math.min(paragraphHeight(clean, { width: CW - 4 }), 48) + 8;
        }

        if (Array.isArray(section.visuals) && section.visuals.length) {
          return 90;
        }

        return 40;
      };

      // KPI metric cards.
      const drawKpi = (visual) => {
        const items = (visual.items || []).slice(0, 4);
        if (!items.length) return;

        const gap = 9;
        const cardW = (CW - gap * (items.length - 1)) / items.length;
        const cardH = 76;

        ensureSpace(cardH + 24);
        const y = doc.y;

        items.forEach((item, i) => {
          const x = MARGIN + i * (cardW + gap);

          box(x, y, cardW, cardH, C.white, C.border);

          doc
            .font(FONT.regular)
            .fontSize(8)
            .fillColor(C.muted)
            .text(str(item.label, `Metric ${i + 1}`), x + 9, y + 10, {
              width: cardW - 18,
              height: 20,
              ellipsis: true,
            });

          doc
            .font(FONT.bold)
            .fontSize(cardW < 100 ? 15 : 19)
            .fillColor(C.primary)
            .text(str(item.value, "—"), x + 9, y + 33, {
              width: cardW - 18,
              height: 24,
              ellipsis: true,
            });

          if (item.note) {
            doc
              .font(FONT.regular)
              .fontSize(7)
              .fillColor(C.muted)
              .text(str(item.note), x + 9, y + 59, {
                width: cardW - 18,
                height: 10,
                ellipsis: true,
              });
          }
        });

        doc.y = y + cardH + 15;
      };

      // Responsive-width table with repeated header on page breaks.
      const drawTable = (visual) => {
        const columns = visual.columns || [];
        const rows = visual.rows || [];
        if (!columns.length) return;

        const count = columns.length;
        const colW = CW / count;
        const pad = 7;
        const fontSize = count > 4 ? 7 : 8.5;

        const cellText = (value) =>
          Array.isArray(value)
            ? value.map((v) => str(v)).join(", ")
            : str(value);

        // Keep title + header + first row together.
        ensureSpace((visual.title ? 24 : 0) + 27 * 2 + 10);

        if (visual.title) {
          doc
            .font(FONT.bold)
            .fontSize(10.5)
            .fillColor(C.primary)
            .text(visual.title, MARGIN, doc.y, { width: CW });
          doc.moveDown(0.4);
        }

        const measure = (row, header = false) => {
          doc
            .font(header ? FONT.bold : FONT.regular)
            .fontSize(fontSize);

          let maxHeight = 0;

          columns.forEach((_, i) => {
            const text = cellText(row[i] ?? "");
            maxHeight = Math.max(
              maxHeight,
              doc.heightOfString(text, {
                width: Math.max(20, colW - pad * 2),
                lineGap: 1.5,
              }),
            );
          });

          return Math.max(27, maxHeight + pad * 2);
        };

        const drawRow = (row, header, rowIndex) => {
          const height = measure(row, header);

          if (!atTop() && doc.y + height > BOTTOM()) {
            doc.addPage();

            // Repeat column headers after a page break.
            if (!header) drawRow(columns, true, -1);
          }

          const y = doc.y;

          if (header) {
            doc.save();
            doc.rect(MARGIN, y, CW, height).fill(C.primary);
            doc.restore();
          } else if (rowIndex % 2 === 0) {
            doc.save();
            doc.rect(MARGIN, y, CW, height).fill(C.background);
            doc.restore();
          }

          row.forEach((cell, i) => {
            const x = MARGIN + i * colW;

            doc
              .font(header ? FONT.bold : FONT.regular)
              .fontSize(fontSize)
              .fillColor(header ? C.white : C.text)
              .text(cellText(cell), x + pad, y + pad, {
                width: colW - pad * 2,
                lineGap: 1.5,
              });

            if (i > 0) {
              line(x, y, x, y + height, C.border, 0.5);
            }
          });

          line(MARGIN, y + height, W - MARGIN, y + height);
          doc.y = y + height;
        };

        drawRow(columns, true, -1);

        rows.forEach((row, i) => {
          const normalized = Array.isArray(row)
            ? row
            : columns.map((column) => row?.[column] ?? "");

          drawRow(normalized, false, i);
        });

        doc.y += 13;
      };

      // Horizontal bar chart, drawn as vector graphics.
      const drawBar = (visual) => {
        const labels = visual.labels || [];
        const values = (visual.values || []).map(num);
        const count = Math.min(labels.length, values.length, 12);

        if (!count) return;

        const rowH = 25;

        // Check space BEFORE drawing the title so it never gets orphaned.
        ensureSpace(count * rowH + 50);

        const title = str(visual.title, "Data comparison");
        doc
          .font(FONT.bold)
          .fontSize(10.5)
          .fillColor(C.primary)
          .text(title, MARGIN, doc.y, { width: CW });
        doc.moveDown(0.6);

        const labelW = Math.min(115, CW * 0.32);
        const valueW = 48;
        const barX = MARGIN + labelW;
        const barW = CW - labelW - valueW - 8;
        const maxValue = Math.max(
          1,
          ...values.slice(0, count).map((v) => Math.abs(v)),
        );

        for (let i = 0; i < count; i++) {
          if (!atTop() && doc.y + rowH > BOTTOM()) doc.addPage();

          const y = doc.y;
          const value = values[i];

          doc
            .font(FONT.regular)
            .fontSize(8)
            .fillColor(C.text)
            .text(str(labels[i]), MARGIN, y + 4, {
              width: labelW - 8,
              height: 16,
              ellipsis: true,
            });

          doc.save();
          doc.roundedRect(barX, y + 5, barW, 12, 4).fill("#F1F5F9");
          doc
            .roundedRect(
              barX,
              y + 5,
              Math.max(2, (Math.abs(value) / maxValue) * barW),
              12,
              4,
            )
            .fill([C.accent, C.purple, C.green][i % 3]);
          doc.restore();

          doc
            .font(FONT.bold)
            .fontSize(8)
            .fillColor(C.primary)
            .text(
              `${str(visual.valuePrefix)}${value.toLocaleString("en-US")}${str(visual.valueSuffix)}`,
              barX + barW + 6,
              y + 4,
              { width: valueW, height: 16, ellipsis: true },
            );

          doc.y = y + rowH;
        }

        doc.y += 8;
        line(MARGIN, doc.y, W - MARGIN, doc.y);
        doc.y += 12;
      };

      // Line chart for ordered data or time series.
      const drawLineChart = (visual) => {
        const labels = visual.labels || [];
        const values = (visual.values || []).map(num);
        const count = Math.min(labels.length, values.length, 12);

        if (count < 2) return drawBar(visual);

        const chartH = 155;
        ensureSpace(chartH + 35);

        doc
          .font(FONT.bold)
          .fontSize(10.5)
          .fillColor(C.primary)
          .text(str(visual.title, "Trend analysis"), MARGIN, doc.y, {
            width: CW,
          });

        const x0 = MARGIN + 20;
        const y0 = doc.y + 20;
        const plotW = CW - 40;
        const plotH = 98;
        const min = Math.min(0, ...values.slice(0, count));
        const max = Math.max(1, ...values.slice(0, count));
        const range = max - min || 1;

        for (let i = 0; i <= 4; i++) {
          const y = y0 + (plotH * i) / 4;
          line(x0, y, x0 + plotW, y, C.border, 0.6);
        }

        const points = values.slice(0, count).map((value, i) => ({
          x: x0 + (plotW * i) / (count - 1),
          y: y0 + plotH - ((value - min) / range) * plotH,
          value,
          label: str(labels[i]),
        }));

        doc.save();
        doc.lineWidth(2).strokeColor(C.accent);

        points.forEach((point, i) => {
          if (i === 0) doc.moveTo(point.x, point.y);
          else doc.lineTo(point.x, point.y);
        });

        doc.stroke();

        points.forEach((point) => {
          doc.circle(point.x, point.y, 3).fillAndStroke(C.white, C.accent);

          if (count <= 7) {
            doc
              .font(FONT.bold)
              .fontSize(7)
              .fillColor(C.primary)
              .text(
                `${str(visual.valuePrefix)}${point.value}${str(visual.valueSuffix)}`,
                point.x - 24,
                point.y - 15,
                { width: 48, align: "center", height: 10 },
              );
          }

          doc
            .font(FONT.regular)
            .fontSize(7)
            .fillColor(C.muted)
            .text(point.label, point.x - 25, y0 + plotH + 7, {
              width: 50,
              height: 18,
              align: "center",
              ellipsis: true,
            });
        });

        doc.restore();
        doc.y = y0 + plotH + 32;
        line(MARGIN, doc.y, W - MARGIN, doc.y);
        doc.y += 12;
      };

      // Donut chart with legend.
      const drawDonut = (visual) => {
        const labels = visual.labels || [];
        const values = (visual.values || []).map((v) => Math.max(0, num(v)));
        const count = Math.min(labels.length, values.length, 8);
        const total = values.slice(0, count).reduce((a, b) => a + b, 0);

        if (!count || total <= 0) return;

        ensureSpace(185);

        doc
          .font(FONT.bold)
          .fontSize(10.5)
          .fillColor(C.primary)
          .text(str(visual.title, "Composition"), MARGIN, doc.y, {
            width: CW,
          });

        const cx = MARGIN + 91;
        const cy = doc.y + 80;
        const r = 53;
        const inner = 30;

        const palette = [
          C.accent, C.purple, C.green, C.orange,
          "#0891B2", "#DB2777", "#4F46E5", "#64748B",
        ];

        let angle = -Math.PI / 2;

        values.slice(0, count).forEach((value, i) => {
          const next = angle + (value / total) * Math.PI * 2;
          const x1 = cx + r * Math.cos(angle);
          const y1 = cy + r * Math.sin(angle);
          const x2 = cx + r * Math.cos(next);
          const y2 = cy + r * Math.sin(next);
          const largeArc = next - angle > Math.PI ? 1 : 0;

          doc.save();
          doc
            .path(
              `M ${cx} ${cy} L ${x1} ${y1} ` +
              `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
            )
            .fill(palette[i % palette.length]);
          doc.restore();

          angle = next;
        });

        doc.save();
        doc.circle(cx, cy, inner).fill(C.white);
        doc.restore();

        doc
          .font(FONT.bold)
          .fontSize(11)
          .fillColor(C.primary)
          .text(total.toLocaleString("en-US"), cx - inner, cy - 6, {
            width: inner * 2,
            align: "center",
          });

        const lx = MARGIN + 170;

        for (let i = 0; i < count; i++) {
          const y = cy - 47 + i * 18;
          doc.save();
          doc.rect(lx, y + 2, 8, 8).fill(palette[i % palette.length]);
          doc.restore();

          doc
            .font(FONT.regular)
            .fontSize(8)
            .fillColor(C.text)
            .text(
              `${str(labels[i])} (${((values[i] / total) * 100).toFixed(1)}%)`,
              lx + 14,
              y,
              { width: CW - 185, height: 14, ellipsis: true },
            );
        }

        doc.y = cy + r + 18;
        line(MARGIN, doc.y, W - MARGIN, doc.y);
        doc.y += 12;
      };

      const drawCallout = (visual) => {
        const title = str(visual.title, "Key takeaway");
        const body = str(visual.text || visual.content || visual.description);

        doc.font(FONT.regular).fontSize(9.5);
        const bodyH = body
          ? doc.heightOfString(body, { width: CW - 28, lineGap: 3 })
          : 0;

        const height = 39 + bodyH + 10;
        ensureSpace(height + 8);
        const y = doc.y;

        box(MARGIN, y, CW, height, C.light, "#BFDBFE");

        doc
          .font(FONT.bold)
          .fontSize(10)
          .fillColor(C.primary)
          .text(title, MARGIN + 14, y + 11, { width: CW - 28 });

        if (body) {
          doc
            .font(FONT.regular)
            .fontSize(9.5)
            .fillColor(C.text)
            .text(body, MARGIN + 14, y + 29, {
              width: CW - 28,
              lineGap: 3,
            });
        }

        doc.y = y + height + 12;
      };

      const drawProcess = (visual) => {
        const items = (visual.items || []).slice(0, 6);
        if (!items.length) return;

        const gap = 8;
        const cardW = (CW - gap * (items.length - 1)) / items.length;
        const cardH = 72;

        ensureSpace(cardH + 42);

        if (visual.title) {
          doc
            .font(FONT.bold)
            .fontSize(10.5)
            .fillColor(C.primary)
            .text(visual.title, MARGIN, doc.y, { width: CW });
          doc.moveDown(0.5);
        }

        const y = doc.y;

        items.forEach((item, i) => {
          const x = MARGIN + i * (cardW + gap);
          const title = typeof item === "string"
            ? item
            : str(item.title || item.label, `Step ${i + 1}`);
          const description = typeof item === "string"
            ? ""
            : str(item.description);

          box(x, y, cardW, cardH, C.background, C.border, 7);

          doc
            .font(FONT.bold)
            .fontSize(8)
            .fillColor(C.primary)
            .text(`${i + 1}. ${title}`, x + 6, y + 10, {
              width: cardW - 12,
              height: 28,
              align: "center",
              ellipsis: true,
            });

          if (description) {
            doc
              .font(FONT.regular)
              .fontSize(7)
              .fillColor(C.muted)
              .text(description, x + 6, y + 40, {
                width: cardW - 12,
                height: 24,
                align: "center",
                ellipsis: true,
              });
          }

          if (i < items.length - 1) {
            doc
              .font(FONT.bold)
              .fontSize(13)
              .fillColor(C.accent)
              .text("›", x + cardW, y + 25, {
                width: gap,
                align: "center",
              });
          }
        });

        doc.y = y + cardH + 15;
      };

      const renderVisual = (visual) => {
        if (!visual || typeof visual !== "object") return;

        switch (visual.type) {
          case "kpi":
            drawKpi(visual);
            break;
          case "bar":
            drawBar(visual);
            break;
          case "line":
            drawLineChart(visual);
            break;
          case "donut":
          case "pie":
            drawDonut(visual);
            break;
          case "table":
            drawTable(visual);
            break;
          case "callout":
            drawCallout(visual);
            break;
          case "process":
          case "timeline":
            drawProcess(visual);
            break;
          default:
            break;
        }
      };

      // ───────────── Cover page ─────────────
      doc.save();
      doc.rect(0, 0, W, 9).fill(C.accent);
      doc.restore();

      doc.y = 145;

      doc
        .font(FONT.bold)
        .fontSize(str(data.title, "Generated Document").length > 45 ? 27 : 33)
        .fillColor(C.primary)
        .text(str(data.title, "Generated Document"), MARGIN, doc.y, {
          width: CW,
          lineGap: 5,
        });

      doc.moveDown(0.7);
      const accentY = doc.y;

      doc.save();
      doc.roundedRect(MARGIN, accentY, 76, 5, 2).fill(C.accent);
      doc.restore();

      doc.y = accentY + 24;

      if (data.subtitle) {
        doc
          .font(FONT.regular)
          .fontSize(13)
          .fillColor(C.muted)
          .text(data.subtitle, MARGIN, doc.y, {
            width: CW * 0.92,
            lineGap: 4,
          });

        doc.moveDown(1.2);
      }

      doc
        .font(FONT.bold)
        .fontSize(8)
        .fillColor(C.accent)
        .text("PREPARED WITH NoBound AI", MARGIN, doc.y, {
          characterSpacing: 1.3,
        });

      if (data.date) {
        doc.moveDown(1.2);
        doc
          .font(FONT.regular)
          .fontSize(9)
          .fillColor(C.muted)
          .text(str(data.date), MARGIN, doc.y);
      }

      doc.addPage();

      // ───────────── Optional contents page ─────────────
      const sections = Array.isArray(data.sections) ? data.sections : [];
      const includeToc =
        data.tableOfContents === true ||
        (data.tableOfContents !== false && sections.length >= 5);

      if (includeToc) {
        doc
          .font(FONT.bold)
          .fontSize(21)
          .fillColor(C.primary)
          .text("Contents", MARGIN, doc.y);

        doc.moveDown(0.9);

        sections.forEach((section, i) => {
          doc
            .font(FONT.regular)
            .fontSize(10)
            .fillColor(C.text)
            .text(
              `${String(i + 1).padStart(2, "0")}   ${str(section.heading, `Section ${i + 1}`)}`,
              MARGIN,
              doc.y,
              { width: CW, lineGap: 2 },
            );

          doc.moveDown(0.4);
        });

        doc.addPage();
      }

      // ───────────── Main content ─────────────
      sections.forEach((section, sectionIndex) => {
        sectionHeading(
          str(section.heading, `Section ${sectionIndex + 1}`),
          firstBlockHeight(section),
        );

        const content = Array.isArray(section.content)
          ? section.content
          : [];

        content.forEach((item, i) => {
          const text = str(item).trim();
          if (!text) return;

          if (/^\s*[-•]\s+/.test(text)) {
            bullet(text, i, false);
          } else if (/^\s*\d+[.)]\s+/.test(text)) {
            bullet(text, i, true);
          } else {
            paragraph(text, { x: MARGIN + 2, width: CW - 4 });
          }
        });

        const visuals = Array.isArray(section.visuals)
          ? section.visuals
          : [];

        visuals.forEach(renderVisual);
        // Spacing between sections is handled by sectionHeading's top gap.
      });

      if (Array.isArray(data.references) && data.references.length) {
        sectionHeading("References", 40);

        data.references.forEach((reference, i) => {
          paragraph(`${i + 1}. ${str(reference)}`, {
            fontSize: 9,
            gap: 5,
          });
        });
      }

      // ───────────── Headers and footers ─────────────
      const pages = doc.bufferedPageRange();

      for (let i = pages.start; i < pages.start + pages.count; i++) {
        doc.switchToPage(i);

        // IMPORTANT: footer text sits inside the bottom margin. Without this,
        // PDFKit thinks it overflowed and appends a blank page each time.
        doc.page.margins.bottom = 0;

        const pageNumber = i - pages.start + 1;

        if (pageNumber === 1) {
          doc.save();
          doc.rect(0, 0, W, 9).fill(C.accent);
          doc.restore();

          doc
            .font(FONT.regular)
            .fontSize(8)
            .fillColor(C.muted)
            .text("NoBound AI", MARGIN, H - 42, {
              lineBreak: false,
            });

          continue;
        }

        doc
          .font(FONT.bold)
          .fontSize(8)
          .fillColor(C.muted)
          .text("NoBound AI", MARGIN, 25, {
            width: 90,
            lineBreak: false,
          });

        doc
          .font(FONT.regular)
          .fontSize(8)
          .fillColor(C.muted)
          .text(str(data.title, "Generated Document"), MARGIN + 95, 25, {
            width: CW - 95,
            align: "right",
            lineBreak: false,
            ellipsis: true,
          });

        line(MARGIN, 45, W - MARGIN, 45, C.border, 0.7);
        line(MARGIN, H - 42, W - MARGIN, H - 42, C.border, 0.7);

        doc
          .font(FONT.regular)
          .fontSize(8)
          .fillColor(C.muted)
          .text("Generated with NoBound AI", MARGIN, H - 30, {
            lineBreak: false,
          });

        doc.text(String(pageNumber), MARGIN, H - 30, {
          width: CW,
          align: "right",
          lineBreak: false,
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });

export default generatePdf;