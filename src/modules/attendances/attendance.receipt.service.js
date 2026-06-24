import { DateTime } from "luxon";
import PDFDocument from "pdfkit";

import { ROLES } from "../../constants/roles.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { getSettings } from "../settings/settings.service.js";
import {
  findAttendanceById,
  findProfessionalByUserId,
} from "./attendance.repository.js";
import { calculateAttendanceTotals } from "./attendance.utils.js";

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

async function ensureReceiptAccess(actor, attendance) {
  if (actor.role === ROLES.ADMIN) return;
  if (actor.role === ROLES.PROFESSIONAL) {
    const own = await findProfessionalByUserId(actor.id);
    if (!own || own.id !== attendance.professionalId) {
      throw new ForbiddenError("Acesso negado.");
    }
    return;
  }
  throw new ForbiddenError("Acesso negado.");
}

function assertReceiptEligible(attendance) {
  const isFinished = attendance.status === "FINISHED";
  const hasPayment =
    attendance.payment?.status === "PENDING" ||
    attendance.payment?.status === "PAID";

  if (!isFinished && !hasPayment) {
    throw new BadRequestError(
      "Comprovante disponível apenas para atendimentos finalizados ou com pagamento registrado.",
    );
  }
}

export async function getAttendanceReceiptData(attendanceId, actor) {
  const attendance = await findAttendanceById(attendanceId);
  if (!attendance) throw new NotFoundError("Atendimento não encontrado.");

  await ensureReceiptAccess(actor, attendance);
  assertReceiptEligible(attendance);

  const [settings, totals] = await Promise.all([
    getSettings(),
    Promise.resolve(calculateAttendanceTotals(attendance)),
  ]);

  return { attendance, settings, totals };
}

export function renderAttendanceReceiptPdf({ attendance, settings, totals }) {
  const doc = new PDFDocument({ size: "A4", margin: 52, autoFirstPage: true });

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const now = DateTime.now().setZone(TZ);

  // ── Header ───────────────────────────────────────────────────────
  const shopName = settings.barbershopName || "ALPHAMEN BARBEARIA";

  doc
    .fontSize(22)
    .font("Helvetica-Bold")
    .text(shopName.toUpperCase(), { align: "center" });

  doc
    .fontSize(11)
    .font("Helvetica")
    .moveDown(0.3)
    .text("Comprovante de Atendimento", { align: "center" });

  doc.moveDown(0.8);
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.margins.left + pageWidth, doc.y)
    .strokeColor("#cccccc")
    .stroke();
  doc.moveDown(0.6);

  // ── Meta ─────────────────────────────────────────────────────────
  const metaY = doc.y;
  doc.fontSize(10).font("Helvetica-Bold").text(`Nº: #${attendance.id.slice(0, 8).toUpperCase()}`, { continued: false });
  doc.fontSize(10).font("Helvetica").text(`Emitido em: ${now.toFormat("dd/MM/yyyy HH:mm")}`, { align: "right" });
  doc.y = metaY + 22;

  doc.moveDown(0.8);

  // ── Barbearia ────────────────────────────────────────────────────
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#444444").text("BARBEARIA");
  doc.fontSize(9).font("Helvetica").fillColor("#222222");

  if (shopName) doc.text(shopName);
  if (settings.phone) doc.text(`Tel: ${settings.phone}`);
  if (settings.instagram) doc.text(`@${settings.instagram.replace(/^@/, "")}`);
  const addressLine = buildAddressLine(settings.address ?? {});
  if (addressLine) doc.text(addressLine);

  doc.moveDown(0.8);

  // ── Cliente ──────────────────────────────────────────────────────
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#444444").text("CLIENTE");
  doc.fontSize(9).font("Helvetica").fillColor("#222222");

  doc.text(`Nome: ${attendance.client?.name || "—"}`);
  if (attendance.client?.phone) doc.text(`Tel: ${attendance.client.phone}`);
  doc.text(`Profissional: ${attendance.professional?.name || "—"}`);
  doc.text(`Data/Hora: ${formatDateBrt(attendance.startedAt)}`);
  if (attendance.finishedAt) doc.text(`Finalização: ${formatDateBrt(attendance.finishedAt)}`);

  doc.moveDown(0.8);

  // ── Serviços e itens ─────────────────────────────────────────────
  const hasService = Boolean(attendance.appointment?.service);
  const hasItems = attendance.items?.length > 0;

  if (hasService || hasItems) {
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#444444").text("SERVIÇOS E ITENS");

    doc
      .moveTo(doc.page.margins.left, doc.y + 4)
      .lineTo(doc.page.margins.left + pageWidth, doc.y + 4)
      .strokeColor("#cccccc")
      .stroke();
    doc.moveDown(0.3);

    // Header row
    const col = {
      desc: doc.page.margins.left,
      qty: doc.page.margins.left + pageWidth * 0.52,
      unit: doc.page.margins.left + pageWidth * 0.66,
      total: doc.page.margins.left + pageWidth * 0.82,
    };

    doc.fontSize(8).font("Helvetica-Bold").fillColor("#555555");
    doc.text("Descrição", col.desc, doc.y, { width: pageWidth * 0.5 });
    doc.text("Qtd", col.qty, doc.y - doc.currentLineHeight(), { width: 40, align: "right" });
    doc.text("Unit.", col.unit, doc.y - doc.currentLineHeight(), { width: 70, align: "right" });
    doc.text("Total", col.total, doc.y - doc.currentLineHeight(), { width: pageWidth * 0.18, align: "right" });

    doc.moveDown(0.2);
    doc.font("Helvetica").fillColor("#222222");

    function serviceRow(label, quantity, unitReais, totalReais) {
      const rowY = doc.y;
      doc.fontSize(9).text(label, col.desc, rowY, { width: pageWidth * 0.5 });
      doc.text(String(quantity), col.qty, rowY, { width: 40, align: "right" });
      doc.text(formatCurrencyBrl(unitReais), col.unit, rowY, { width: 70, align: "right" });
      doc.text(formatCurrencyBrl(totalReais), col.total, rowY, { width: pageWidth * 0.18, align: "right" });
      doc.moveDown(0.05);
    }

    if (hasService) {
      const svc = attendance.appointment.service;
      serviceRow(svc.name, 1, Number(svc.price), Number(svc.price));
    }

    for (const item of attendance.items ?? []) {
      serviceRow(item.description || "Item", item.quantity, Number(item.unitPrice), Number(item.total));
    }

    doc.moveDown(0.4);
  }

  // ── Produtos ─────────────────────────────────────────────────────
  const hasProducts = attendance.productItems?.length > 0;

  if (hasProducts) {
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#444444").text("PRODUTOS VENDIDOS");

    doc
      .moveTo(doc.page.margins.left, doc.y + 4)
      .lineTo(doc.page.margins.left + pageWidth, doc.y + 4)
      .strokeColor("#cccccc")
      .stroke();
    doc.moveDown(0.3);

    const col = {
      desc: doc.page.margins.left,
      qty: doc.page.margins.left + pageWidth * 0.52,
      unit: doc.page.margins.left + pageWidth * 0.66,
      total: doc.page.margins.left + pageWidth * 0.82,
    };

    doc.fontSize(8).font("Helvetica-Bold").fillColor("#555555");
    doc.text("Descrição", col.desc, doc.y, { width: pageWidth * 0.5 });
    doc.text("Qtd", col.qty, doc.y - doc.currentLineHeight(), { width: 40, align: "right" });
    doc.text("Unit.", col.unit, doc.y - doc.currentLineHeight(), { width: 70, align: "right" });
    doc.text("Total", col.total, doc.y - doc.currentLineHeight(), { width: pageWidth * 0.18, align: "right" });

    doc.moveDown(0.2);
    doc.font("Helvetica").fillColor("#222222");

    for (const item of attendance.productItems) {
      const rowY = doc.y;
      doc.fontSize(9).text(item.productNameSnapshot || "Produto", col.desc, rowY, { width: pageWidth * 0.5 });
      doc.text(String(item.quantity), col.qty, rowY, { width: 40, align: "right" });
      doc.text(formatCurrencyBrl(item.unitPriceCents / 100), col.unit, rowY, { width: 70, align: "right" });
      doc.text(formatCurrencyBrl(item.totalPriceCents / 100), col.total, rowY, { width: pageWidth * 0.18, align: "right" });
      doc.moveDown(0.05);
    }

    doc.moveDown(0.4);
  }

  // ── Totais ───────────────────────────────────────────────────────
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.margins.left + pageWidth, doc.y)
    .strokeColor("#cccccc")
    .stroke();
  doc.moveDown(0.6);

  doc.fontSize(10).font("Helvetica-Bold").fillColor("#444444").text("RESUMO");
  doc.moveDown(0.3);

  function summaryRow(label, valueReais, bold = false) {
    const rowY = doc.y;
    const font = bold ? "Helvetica-Bold" : "Helvetica";
    const color = bold ? "#111111" : "#333333";
    doc.fontSize(9).font(font).fillColor(color).text(label, doc.page.margins.left, rowY, { width: pageWidth * 0.7 });
    doc.text(formatCurrencyBrl(valueReais), doc.page.margins.left, rowY, { width: pageWidth, align: "right" });
    doc.moveDown(0.1);
  }

  summaryRow("Serviços:", totals.serviceTotalCents / 100);
  summaryRow("Serviços adicionais:", totals.itemsTotalCents / 100);
  summaryRow("Produtos:", totals.productTotalCents / 100);

  doc.moveDown(0.2);
  doc
    .moveTo(doc.page.margins.left + pageWidth * 0.4, doc.y)
    .lineTo(doc.page.margins.left + pageWidth, doc.y)
    .strokeColor("#aaaaaa")
    .stroke();
  doc.moveDown(0.3);

  summaryRow("TOTAL:", totals.grandTotalCents / 100, true);

  doc.moveDown(0.6);

  // ── Pagamento ────────────────────────────────────────────────────
  const payment = attendance.payment;
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#444444").text("PAGAMENTO");
  doc.moveDown(0.3);

  doc.fontSize(9).font("Helvetica").fillColor("#222222");
  doc.text(`Status: ${paymentStatusLabel(payment?.status)}`);
  if (payment?.paymentMethod || payment?.paymentMethodConfig) {
    doc.text(`Forma: ${paymentMethodLabel(payment)}`);
  }
  if (payment?.paidAt) {
    doc.text(`Pago em: ${formatDateBrt(payment.paidAt)}`);
  }

  // ── Rodapé ───────────────────────────────────────────────────────
  doc.moveDown(1.5);
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.margins.left + pageWidth, doc.y)
    .strokeColor("#cccccc")
    .stroke();
  doc.moveDown(0.6);

  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor("#333333")
    .text("Obrigado pela preferência!", { align: "center" });

  doc.moveDown(0.4);
  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor("#888888")
    .text("Este comprovante não substitui documento fiscal.", { align: "center" });

  doc.moveDown(0.3);
  doc.text(`Emitido em: ${now.toFormat("dd/MM/yyyy HH:mm")} (horário de Brasília)`, { align: "center" });

  return doc;
}
