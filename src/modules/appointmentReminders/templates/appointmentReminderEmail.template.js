function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
  }).format(value);
}

function formatTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function buildAppointmentReminderEmailTemplate({
  appPublicUrl,
  appointment,
  barbershopName,
}) {
  const safeBarbershopName = barbershopName?.trim() || "AlphaMen Barbearia";
  const clientName = appointment.client?.name || "Cliente";
  const professionalName = appointment.professional?.name || "Profissional";
  const serviceName = appointment.service?.name || "Serviço";
  const appointmentDate = formatDate(appointment.startAt);
  const appointmentTime = formatTime(appointment.startAt);
  const safeUrl = appPublicUrl?.trim() || "";

  const subject = `Lembrete de agendamento em ${appointmentTime} - ${safeBarbershopName}`;

  const text = [
    `${safeBarbershopName}`,
    "",
    `Olá, ${clientName}.`,
    "Este é um lembrete do seu agendamento.",
    "",
    `Profissional: ${professionalName}`,
    `Serviço: ${serviceName}`,
    `Data: ${appointmentDate}`,
    `Horário: ${appointmentTime}`,
    "",
    safeUrl ? `Acompanhe em: ${safeUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="margin:0;padding:24px;background:#f5f2ea;font-family:Arial,sans-serif;color:#1f1f1f;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e6dfd1;border-radius:18px;overflow:hidden;">
        <div style="padding:28px 28px 20px;background:#111111;color:#f7efe0;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#d4af37;">
            Lembrete de agendamento
          </p>
          <h1 style="margin:0;font-size:24px;line-height:1.3;">${escapeHtml(
            safeBarbershopName,
          )}</h1>
        </div>

        <div style="padding:28px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
            Olá, <strong>${escapeHtml(clientName)}</strong>. Seu atendimento está próximo.
          </p>

          <div style="margin:0 0 20px;padding:20px;border:1px solid #ece6d8;border-radius:14px;background:#fcfaf5;">
            <p style="margin:0 0 10px;font-size:14px;"><strong>Profissional:</strong> ${escapeHtml(
              professionalName,
            )}</p>
            <p style="margin:0 0 10px;font-size:14px;"><strong>Serviço:</strong> ${escapeHtml(
              serviceName,
            )}</p>
            <p style="margin:0 0 10px;font-size:14px;"><strong>Data:</strong> ${escapeHtml(
              appointmentDate,
            )}</p>
            <p style="margin:0;font-size:14px;"><strong>Horário:</strong> ${escapeHtml(
              appointmentTime,
            )}</p>
          </div>

          <p style="margin:0;font-size:14px;line-height:1.6;color:#555555;">
            Se precisar revisar seus dados de atendimento, utilize os canais oficiais da barbearia.
          </p>

          ${
            safeUrl
              ? `<div style="margin-top:24px;">
            <a href="${escapeHtml(
              safeUrl,
            )}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#111111;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
              Acessar sistema
            </a>
          </div>`
              : ""
          }
        </div>
      </div>
    </div>
  `.trim();

  return {
    subject,
    html,
    text,
  };
}
