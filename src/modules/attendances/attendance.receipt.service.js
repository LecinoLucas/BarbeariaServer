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
import { renderClassicReceiptPdf } from "./receiptTemplates/classicReceiptTemplate.js";
import { renderCleanCompactReceiptPdf } from "./receiptTemplates/cleanCompactReceiptTemplate.js";

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
  const template = settings.receiptTemplate || "classic";

  if (template === "clean_compact") {
    return renderCleanCompactReceiptPdf({ attendance, settings, totals });
  }

  return renderClassicReceiptPdf({ attendance, settings, totals });
}
