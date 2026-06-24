import { DateTime } from "luxon";
import PDFDocument from "pdfkit";

const TZ = "America/Sao_Paulo";

function formatCurrencyBrl(reaisValue) {
  return Number(reaisValue).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateBrt(utcDate) {
  if (!utcDate) return "—";
  return DateTime.fromJSDate(new Date(utcDate), { zone: TZ }).toFormat(
    "dd/MM/yyyy HH:mm",
  );
}

function paymentMethodLabel(payment) {
  if (!payment) return "—";
  if (payment.paymentMethodConfig?.name) return payment.paymentMethodConfig.name;
  const labels = {
    PIX: "PIX",
    CASH: "Dinheiro",
    CREDIT_CARD: "Cartão de Crédito",
    DEBIT_CARD: "Cartão de Débito",
    OTHER: "Outro",
  };
  return labels[payment.paymentMethod] || payment.paymentMethod || "—";
}

function paymentStatusLabel(status) {
  if (!status) return "—";
  const labels = {
    PENDING: "Pendente",
    PAID: "Pago",
    CANCELED: "Cancelado",
  };
  return labels[status] || status;
}

export function renderCleanCompactReceiptPdf({ attendance, settings, totals }) {
  // Margens reduzidas para focar em 1 página
  const doc = new PDFDocument({ size: "A4", margin: 40, autoFirstPage: true });

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const now = DateTime.now().setZone(TZ);

  // Design Tokens (Minimalista)
  const colors = {
    primary: "#000000",
    dark: "#111111",
    gray: "#555555",
    lightGray: "#F3F4F6",
    border: "#E5E7EB",
  };

  function ensureSpace(requiredHeight) {
    if (doc.y + requiredHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
  }

  function drawLine(y) {
    doc
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.margins.left + pageWidth, y)
      .strokeColor(colors.border)
      .lineWidth(1)
      .stroke();
  }

  // ── HEADER COMPACTO ──────────────────────────────────────────────
  const shopName = settings.barbershopName || "ALPHAMEN BARBEARIA";

  doc.fontSize(18).font("Helvetica-Bold").fillColor(colors.dark).text(shopName.toUpperCase(), { align: "left", continued: true });
  doc.fontSize(10).font("Helvetica").fillColor(colors.gray).text(`  |  Comprovante de Atendimento`, { align: "left" });
  
  doc.moveDown(0.3);
  doc.fontSize(9).font("Helvetica").text(`Emitido em: ${now.toFormat("dd/MM/yyyy HH:mm")}`, { align: "left" });
  
  // Badge no canto direito
  const metaY = doc.page.margins.top;
  doc.fontSize(10).font("Helvetica-Bold").fillColor(colors.dark).text(`#${attendance.id.slice(0, 8).toUpperCase()}`, doc.page.margins.left, metaY, { align: "right", width: pageWidth });
  
  doc.y = metaY + 30;
  drawLine(doc.y);
  doc.moveDown(0.5);

  // ── INFOS COMPACTAS (Lado a Lado Flex) ───────────────────────────
  const infoY = doc.y;
  const colW = pageWidth / 3;

  doc.fontSize(8).font("Helvetica-Bold").fillColor(colors.dark);
  doc.text("CLIENTE", doc.page.margins.left, infoY, { width: colW });
  doc.text("ATENDIMENTO", doc.page.margins.left + colW, infoY, { width: colW });
  doc.text("PAGAMENTO", doc.page.margins.left + colW * 2, infoY, { width: colW });

  doc.moveDown(0.2);
  doc.fontSize(8).font("Helvetica").fillColor(colors.gray);
  
  // Col 1: Cliente
  doc.text(attendance.client?.name || "—", doc.page.margins.left, doc.y, { width: colW });
  if (attendance.client?.phone) doc.text(attendance.client.phone, doc.page.margins.left, doc.y, { width: colW });
  
  const col1Max = doc.y;

  // Col 2: Atendimento
  doc.y = infoY + 12;
  doc.text(`Prof: ${attendance.professional?.name || "—"}`, doc.page.margins.left + colW, doc.y, { width: colW });
  doc.text(formatDateBrt(attendance.startedAt), doc.page.margins.left + colW, doc.y, { width: colW });
  
  const col2Max = doc.y;

  // Col 3: Pagamento
  doc.y = infoY + 12;
  const payment = attendance.payment;
  doc.text(paymentStatusLabel(payment?.status), doc.page.margins.left + colW * 2, doc.y, { width: colW });
  if (payment?.paymentMethod) {
    doc.text(paymentMethodLabel(payment), doc.page.margins.left + colW * 2, doc.y, { width: colW });
  }

  const col3Max = doc.y;

  doc.y = Math.max(col1Max, col2Max, col3Max) + 15;

  // ── TABELA ÚNICA DE ITENS ────────────────────────────────────────
  ensureSpace(60);
  
  doc.rect(doc.page.margins.left, doc.y, pageWidth, 16).fill(colors.lightGray);
  
  const headerY = doc.y + 4;
  doc.fontSize(8).font("Helvetica-Bold").fillColor(colors.dark);
  
  const cols = {
    type: doc.page.margins.left + 5,
    desc: doc.page.margins.left + 70,
    qty: doc.page.margins.left + pageWidth * 0.6,
    unit: doc.page.margins.left + pageWidth * 0.7,
    total: doc.page.margins.left + pageWidth * 0.85
  };

  doc.text("TIPO", cols.type, headerY);
  doc.text("DESCRIÇÃO", cols.desc, headerY);
  doc.text("QTD", cols.qty, headerY, { width: 30, align: "center" });
  doc.text("UNIT", cols.unit, headerY, { width: 60, align: "right" });
  doc.text("TOTAL", cols.total, headerY, { width: pageWidth * 0.15 - 5, align: "right" });
  
  doc.y += 16;

  function renderRow(type, desc, qty, unit, total, isLast) {
    ensureSpace(20);
    const rowY = doc.y + 6;
    
    doc.fontSize(8).font("Helvetica-Bold").fillColor(colors.gray).text(type, cols.type, rowY);
    doc.font("Helvetica").fillColor(colors.dark).text(desc, cols.desc, rowY, { width: cols.qty - cols.desc - 10 });
    doc.text(String(qty), cols.qty, rowY, { width: 30, align: "center" });
    doc.text(formatCurrencyBrl(unit), cols.unit, rowY, { width: 60, align: "right" });
    doc.text(formatCurrencyBrl(total), cols.total, rowY, { width: pageWidth * 0.15 - 5, align: "right" });
    
    doc.y += 20;
    if (!isLast) drawLine(doc.y);
  }

  const allItems = [];
  
  if (attendance.appointment?.service) {
    const svc = attendance.appointment.service;
    allItems.push({ type: "Serviço", desc: svc.name, qty: 1, unit: Number(svc.price), total: Number(svc.price) });
  }
  
  for (const item of attendance.items ?? []) {
    allItems.push({ type: "Adicional", desc: item.description || "Adicional", qty: item.quantity, unit: Number(item.unitPrice), total: Number(item.total) });
  }
  
  for (const item of attendance.productItems ?? []) {
    allItems.push({ type: "Produto", desc: item.productNameSnapshot || "Produto", qty: item.quantity, unit: item.unitPriceCents / 100, total: item.totalPriceCents / 100 });
  }

  allItems.forEach((item, index) => {
    renderRow(item.type, item.desc, item.qty, item.unit, item.total, index === allItems.length - 1);
  });

  doc.moveDown(0.5);
  drawLine(doc.y);
  doc.moveDown(0.5);

  // ── RESUMO COMPACTO ──────────────────────────────────────────────
  ensureSpace(60);
  
  const summaryX = doc.page.margins.left + pageWidth * 0.6;
  const summaryW = pageWidth * 0.4;
  let summaryY = doc.y;

  function addSummaryLine(label, value, isBold = false) {
    doc.fontSize(8)
       .font(isBold ? "Helvetica-Bold" : "Helvetica")
       .fillColor(isBold ? colors.dark : colors.gray)
       .text(label, summaryX, summaryY, { width: summaryW * 0.5 });
    
    doc.text(formatCurrencyBrl(value), summaryX + summaryW * 0.5, summaryY, { width: summaryW * 0.5, align: "right" });
    summaryY += 12;
  }

  if (totals.serviceTotalCents > 0 || totals.itemsTotalCents > 0) {
    addSummaryLine("Total Serviços:", (totals.serviceTotalCents + totals.itemsTotalCents) / 100);
  }
  if (totals.productTotalCents > 0) {
    addSummaryLine("Total Produtos:", totals.productTotalCents / 100);
  }

  summaryY += 4;
  addSummaryLine("TOTAL GERAL:", totals.grandTotalCents / 100, true);
  
  doc.y = summaryY + 20;

  // ── RODAPÉ CURTO ─────────────────────────────────────────────────
  ensureSpace(40);
  const footerY = Math.max(doc.y, doc.page.height - doc.page.margins.bottom - 40);
  
  doc.fontSize(8).font("Helvetica-Bold").fillColor(colors.dark).text("Obrigado pela preferência!", doc.page.margins.left, footerY, { align: "center", width: pageWidth });
  doc.moveDown(0.2);
  doc.fontSize(7).font("Helvetica").fillColor(colors.gray).text("Este comprovante não substitui documento fiscal.", { align: "center", width: pageWidth });

  return doc;
}
