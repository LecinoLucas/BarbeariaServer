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

function buildAddressLine(address) {
  const parts = [
    address.street,
    address.number,
    address.district,
    address.city && address.state ? `${address.city} - ${address.state}` : address.city || address.state,
    address.zipcode,
  ].filter(Boolean);
  return parts.join(", ");
}

export function renderClassicReceiptPdf({ attendance, settings, totals }) {
  const doc = new PDFDocument({ size: "A4", margin: 50, autoFirstPage: true });

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const now = DateTime.now().setZone(TZ);

  // Design Tokens
  const colors = {
    primary: "#D4AF37", // Dourado
    dark: "#111111", // Preto/Grafite
    gray: "#666666",
    lightGray: "#F9FAFB",
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

  // ── HEADER ────────────────────────────────────────────────────────
  const shopName = settings.barbershopName || "ALPHAMEN BARBEARIA";

  doc.fontSize(24).font("Helvetica-Bold").fillColor(colors.dark).text(shopName.toUpperCase(), { align: "center" });
  doc.fontSize(12).font("Helvetica").fillColor(colors.gray).moveDown(0.3).text("Comprovante de Atendimento", { align: "center" });
  doc.moveDown(1);
  drawLine(doc.y);
  doc.moveDown(0.8);

  // Meta badge
  const metaY = doc.y;
  doc.fontSize(10).font("Helvetica-Bold").fillColor(colors.primary).text(`Comprovante #${attendance.id.slice(0, 8).toUpperCase()}`, doc.page.margins.left, metaY);
  doc.fontSize(10).font("Helvetica").fillColor(colors.gray).text(`Emitido em: ${now.toFormat("dd/MM/yyyy HH:mm")}`, doc.page.margins.left, metaY, { align: "right", width: pageWidth });
  doc.y = metaY + 25;

  // ── TOP CARDS (Lado a Lado) ───────────────────────────────────────
  ensureSpace(100);
  const cardsY = doc.y;
  const cardWidth = (pageWidth - 20) / 2;
  const leftX = doc.page.margins.left;
  const rightX = leftX + cardWidth + 20;

  // Bloco Barbearia
  doc.fontSize(10).font("Helvetica-Bold").fillColor(colors.dark).text("Barbearia", leftX, cardsY);
  doc.moveDown(0.3);
  doc.fontSize(9).font("Helvetica").fillColor(colors.gray);
  doc.text(shopName, leftX, doc.y, { width: cardWidth });
  if (settings.phone) doc.text(`Tel: ${settings.phone}`, leftX, doc.y, { width: cardWidth });
  if (settings.instagram) doc.text(`Instagram: @${settings.instagram.replace(/^@/, "")}`, leftX, doc.y, { width: cardWidth });
  const addressLine = buildAddressLine(settings.address ?? {});
  if (addressLine) doc.text(`Endereço: ${addressLine}`, leftX, doc.y, { width: cardWidth });

  const leftMaxY = doc.y;

  // Bloco Cliente/Atendimento
  doc.fontSize(10).font("Helvetica-Bold").fillColor(colors.dark).text("Cliente / Atendimento", rightX, cardsY);
  doc.moveDown(0.3);
  doc.fontSize(9).font("Helvetica").fillColor(colors.gray);
  doc.text(`Cliente: ${attendance.client?.name || "—"}`, rightX, doc.y, { width: cardWidth });
  if (attendance.client?.phone) doc.text(`Tel: ${attendance.client.phone}`, rightX, doc.y, { width: cardWidth });
  doc.moveDown(0.3);
  doc.text(`Profissional: ${attendance.professional?.name || "—"}`, rightX, doc.y, { width: cardWidth });
  doc.text(`Início: ${formatDateBrt(attendance.startedAt)}`, rightX, doc.y, { width: cardWidth });
  if (attendance.finishedAt) doc.text(`Fim: ${formatDateBrt(attendance.finishedAt)}`, rightX, doc.y, { width: cardWidth });

  const rightMaxY = doc.y;
  doc.y = Math.max(leftMaxY, rightMaxY) + 25;

  // ── TABELAS DE ITENS ─────────────────────────────────────────────
  function renderTableHeader(title) {
    ensureSpace(50);
    doc.fontSize(11).font("Helvetica-Bold").fillColor(colors.primary).text(title.toUpperCase());
    doc.moveDown(0.5);
    
    doc.rect(doc.page.margins.left, doc.y, pageWidth, 20).fill(colors.lightGray);
    
    const colY = doc.y + 6;
    doc.fontSize(8).font("Helvetica-Bold").fillColor(colors.gray);
    doc.text("Descrição", doc.page.margins.left + 10, colY, { width: pageWidth * 0.5 });
    doc.text("Qtd", doc.page.margins.left + pageWidth * 0.55, colY, { width: 30, align: "center" });
    doc.text("Valor unit.", doc.page.margins.left + pageWidth * 0.65, colY, { width: 70, align: "right" });
    doc.text("Total", doc.page.margins.left + pageWidth * 0.82, colY, { width: pageWidth * 0.18 - 10, align: "right" });
    
    doc.y += 20;
  }

  function renderTableRow(desc, qty, unit, total, isLast) {
    ensureSpace(25);
    const rowY = doc.y + 8;
    doc.fontSize(9).font("Helvetica").fillColor(colors.dark);
    doc.text(desc, doc.page.margins.left + 10, rowY, { width: pageWidth * 0.5 });
    doc.text(String(qty), doc.page.margins.left + pageWidth * 0.55, rowY, { width: 30, align: "center" });
    doc.text(formatCurrencyBrl(unit), doc.page.margins.left + pageWidth * 0.65, rowY, { width: 70, align: "right" });
    doc.text(formatCurrencyBrl(total), doc.page.margins.left + pageWidth * 0.82, rowY, { width: pageWidth * 0.18 - 10, align: "right" });
    
    doc.y += 24;
    if (!isLast) {
      drawLine(doc.y);
    }
  }

  // A) Serviço Principal
  if (attendance.appointment?.service) {
    renderTableHeader("Serviço principal");
    const svc = attendance.appointment.service;
    renderTableRow(svc.name, 1, Number(svc.price), Number(svc.price), true);
    doc.moveDown(1.5);
  }

  // B) Serviços Adicionais
  if (attendance.items?.length > 0) {
    renderTableHeader("Serviços adicionais");
    attendance.items.forEach((item, idx) => {
      renderTableRow(item.description || "Adicional", item.quantity, Number(item.unitPrice), Number(item.total), idx === attendance.items.length - 1);
    });
    doc.moveDown(1.5);
  }

  // C) Produtos Vendidos
  if (attendance.productItems?.length > 0) {
    renderTableHeader("Produtos vendidos");
    attendance.productItems.forEach((item, idx) => {
      renderTableRow(item.productNameSnapshot || "Produto", item.quantity, item.unitPriceCents / 100, item.totalPriceCents / 100, idx === attendance.productItems.length - 1);
    });
    doc.moveDown(1.5);
  }

  // ── RESUMO FINANCEIRO E PAGAMENTO ────────────────────────────────
  ensureSpace(120);
  const bottomY = doc.y;
  
  // Pagamento
  doc.fontSize(10).font("Helvetica-Bold").fillColor(colors.dark).text("PAGAMENTO", leftX, bottomY);
  doc.moveDown(0.5);
  doc.fontSize(9).font("Helvetica").fillColor(colors.gray);
  
  const payment = attendance.payment;
  doc.text(`Status: ${paymentStatusLabel(payment?.status)}`, leftX, doc.y, { width: cardWidth });
  if (payment?.paymentMethod || payment?.paymentMethodConfig) {
    doc.text(`Forma: ${paymentMethodLabel(payment)}`, leftX, doc.y, { width: cardWidth });
  }
  if (payment?.paidAt) {
    doc.text(`Pago em: ${formatDateBrt(payment.paidAt)}`, leftX, doc.y, { width: cardWidth });
  }

  const payMaxY = doc.y;

  // Resumo
  doc.fontSize(10).font("Helvetica-Bold").fillColor(colors.dark).text("RESUMO", rightX, bottomY);
  doc.moveDown(0.5);
  
  let summaryY = doc.y;
  function addSummaryLine(label, value, isBold = false) {
    doc.fontSize(9)
       .font(isBold ? "Helvetica-Bold" : "Helvetica")
       .fillColor(isBold ? colors.dark : colors.gray)
       .text(label, rightX, summaryY, { width: cardWidth * 0.6 });
    
    doc.text(formatCurrencyBrl(value), rightX + cardWidth * 0.6, summaryY, { width: cardWidth * 0.4, align: "right" });
    summaryY += 14;
  }

  if (totals.serviceTotalCents > 0) addSummaryLine("Serviço principal:", totals.serviceTotalCents / 100);
  if (totals.itemsTotalCents > 0) addSummaryLine("Serviços adicionais:", totals.itemsTotalCents / 100);
  if (totals.productTotalCents > 0) addSummaryLine("Produtos:", totals.productTotalCents / 100);

  summaryY += 4;
  doc.moveTo(rightX, summaryY).lineTo(rightX + cardWidth, summaryY).strokeColor(colors.border).lineWidth(1).stroke();
  summaryY += 8;

  addSummaryLine("TOTAL", totals.grandTotalCents / 100, true);
  
  doc.y = Math.max(payMaxY, summaryY) + 40;

  // ── RODAPÉ ───────────────────────────────────────────────────────
  ensureSpace(60);
  const footerY = Math.max(doc.y, doc.page.height - doc.page.margins.bottom - 60);
  
  drawLine(footerY);
  doc.y = footerY + 15;
  doc.fontSize(9).font("Helvetica-Bold").fillColor(colors.dark).text("Obrigado pela preferência!", { align: "center" });
  doc.moveDown(0.2);
  doc.fontSize(8).font("Helvetica").fillColor(colors.gray).text("Este comprovante não substitui documento fiscal.", { align: "center" });
  doc.moveDown(0.2);
  doc.fontSize(8).font("Helvetica").fillColor(colors.gray).text(`Emitido pelo sistema Alphamen Barbearia em ${TZ}.`, { align: "center" });

  return doc;
}
