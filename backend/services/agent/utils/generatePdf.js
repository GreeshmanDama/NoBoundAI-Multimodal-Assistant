import PDFDocument from "pdfkit";

const COLORS = {
  primary: "#172554",
  accent: "#3B82F6",
  text: "#374151",
  muted: "#6B7280",
  border: "#E5E7EB",
  background: "#F3F6FC",
  white: "#FFFFFF",
};

const PAGE = {
  margin: 55,
  headerY: 28,
  footerY: 770,
};

const generatePdf = async (data = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: {
          top: 65,
          bottom: 65,
          left: PAGE.margin,
          right: PAGE.margin,
        },
        bufferPages: true,
        autoFirstPage: true,
        info: {
          Author: "NoBound AI",
          Title: data.title || "Generated Document",
          Creator: "NoBound AI",
          Subject: data.subtitle || "AI Generated Document",
        },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("error", reject);
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const pageWidth = doc.page.width;
      const contentWidth = pageWidth - PAGE.margin * 2;
      const bottomLimit = () => doc.page.height - doc.page.margins.bottom;

      // Draw a horizontal divider
      const drawLine = (y, color = COLORS.border, thickness = 1) => {
        doc
          .save()
          .moveTo(PAGE.margin, y)
          .lineTo(pageWidth - PAGE.margin, y)
          .lineWidth(thickness)
          .strokeColor(color)
          .stroke()
          .restore();
      };

      // Ensure space or create a new page
      const ensureSpace = (height) => {
        const availableHeight = bottomLimit() - doc.y;

        if (height > availableHeight && doc.y > doc.page.margins.top) {
          doc.addPage();
        }
      };

      // Helper to parse **bold** parts in a string
      const renderFormattedText = (doc, text, startX, startY, options = {}) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        doc.text("", startX, startY, { continued: true });

        parts.forEach((part, index) => {
          const isLast = index === parts.length - 1;

          if (part.startsWith("**") && part.endsWith("**")) {
            const boldText = part.slice(2, -2);
            doc
              .font("Helvetica-Bold")
              .text(boldText, { continued: !isLast, ...options });
          } else if (part) {
            doc
              .font("Helvetica")
              .text(part, { continued: !isLast, ...options });
          }
        });
      };

      // ----- DOCUMENT TITLE -----
      doc
        .fillColor(COLORS.primary)
        .font("Helvetica-Bold")
        .fontSize(27)
        .text(data.title || "Generated Document", {
          width: contentWidth,
          align: "left",
          lineGap: 4,
        });

      doc.moveDown(0.65);
      const accentY = doc.y;

      doc
        .save()
        .roundedRect(PAGE.margin, accentY, 65, 4, 2)
        .fill(COLORS.accent)
        .restore();

      doc.y = accentY + 17;

      // ----- DOCUMENT SUBTITLE -----
      if (data.subtitle) {
        doc
          .fillColor(COLORS.muted)
          .font("Helvetica")
          .fontSize(11)
          .text(data.subtitle, {
            width: contentWidth,
            lineGap: 3,
          });
        doc.moveDown(0.6);
      }

      doc
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(9)
        .text("PREPARED WITH NoBound AI", { characterSpacing: 1.1 });

      doc.moveDown(1.5);
      drawLine(doc.y, COLORS.border, 1);
      doc.moveDown(1.5);

      // ----- DOCUMENT SECTIONS -----
      const sections = Array.isArray(data.sections) ? data.sections : [];

      sections.forEach((section, index) => {
        const heading = section.heading || `Section ${index + 1}`;
        const paragraphs = Array.isArray(section.content)
          ? section.content
          : [];

        doc.font("Helvetica-Bold").fontSize(16);
        const headingHeight = doc.heightOfString(heading, {
          width: contentWidth - 14,
        });

        ensureSpace(headingHeight + 40);

        // Section Heading Container
        const headingY = doc.y;
        doc
          .save()
          .fillColor(COLORS.accent)
          .roundedRect(
            PAGE.margin,
            headingY - 3,
            4,
            Math.max(headingHeight, 19),
            2,
          )
          .fill()
          .restore();

        doc
          .fillColor(COLORS.primary)
          .font("Helvetica-Bold")
          .fontSize(16)
          .text(heading, PAGE.margin + 14, headingY, {
            width: contentWidth - 14,
            lineGap: 3,
          });

        doc.moveDown(0.45);
        drawLine(doc.y, COLORS.border, 0.7);
        doc.moveDown(0.8);

        // Section Paragraphs
        paragraphs.forEach((paragraph) => {
          const text = String(paragraph ?? "").trim();
          if (!text) return;

          doc.font("Helvetica").fontSize(11);
          const textHeight = doc.heightOfString(text, {
            width: contentWidth - 12,
            lineGap: 4,
          });

          ensureSpace(textHeight + 10);
          const paragraphY = doc.y;

          renderFormattedText(doc, text, PAGE.margin + 12, paragraphY, {
            width: contentWidth - 12,
            lineGap: 4,
            paragraphGap: 5,
            align: "left",
          });

          doc.moveDown(0.65);
        });

        doc.moveDown(0.8);
      });

      // ----- HEADER AND FOOTER -----
      const pageRange = doc.bufferedPageRange();

      for (
        let pageIndex = pageRange.start;
        pageIndex < pageRange.start + pageRange.count;
        pageIndex++
      ) {
        doc.switchToPage(pageIndex);
        const pageNumber = pageIndex - pageRange.start + 1;

        // Header
        doc
          .save()
          .fillColor(COLORS.muted)
          .font("Helvetica-Bold")
          .fontSize(8)
          .text("NoBound AI", PAGE.margin, PAGE.headerY, { lineBreak: false })
          .font("Helvetica")
          .text(data.title || "Generated Document", PAGE.margin, PAGE.headerY, {
            width: contentWidth,
            align: "right",
            lineBreak: false,
            ellipsis: true,
          })
          .restore();

        drawLine(46, COLORS.border, 0.7);

        // Footer
        drawLine(PAGE.footerY - 8, COLORS.border, 0.7);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

export default generatePdf;
