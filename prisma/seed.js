import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/hash.js";

const prisma = new PrismaClient();

const defaultSettings = [
  { key: "appointment_reminder_enabled", value: "true" },
  { key: "appointment_reminder_email_enabled", value: "false" },
  { key: "appointment_reminder_minutes", value: "15" },
  { key: "default_open_time", value: "09:00" },
  { key: "default_close_time", value: "18:00" },
  { key: "appointment_interval_minutes", value: "5" },
  { key: "allow_client_cancel", value: "true" },
  { key: "allow_client_reschedule", value: "true" },
  { key: "client_portal_enabled", value: "true" },
  { key: "client_portal_self_signup_enabled", value: "true" },
  { key: "client_portal_require_admin_approval", value: "false" },
  { key: "client_portal_google_login_enabled", value: "false" },
  { key: "client_portal_booking_enabled", value: "true" },
  { key: "client_portal_cancel_enabled", value: "true" },
  { key: "client_portal_cancel_min_hours", value: "0" },
  { key: "client_portal_show_prices", value: "true" },
  { key: "client_portal_show_duration", value: "true" },
  { key: "client_portal_show_professional", value: "true" },
  { key: "client_portal_support_label", value: "Fale com a barbearia" },
  { key: "client_portal_support_url", value: "" },
  { key: "client_portal_booking_success_message", value: "Agendamento confirmado com sucesso." },
  {
    key: "client_portal_no_slots_message",
    value: "Não encontramos horários para essa combinação. Tente outro profissional ou data.",
  },
  { key: "client_portal_booking_min_hours_advance", value: "0" },
  { key: "client_portal_booking_max_days_ahead", value: "30" },
  { key: "client_portal_max_active_appointments", value: "1" },
  { key: "client_portal_notes_enabled", value: "true" },
  { key: "client_portal_notes_required", value: "false" },
  {
    key: "client_portal_booking_instruction",
    value: "Confira os dados antes de confirmar seu agendamento.",
  },
  { key: "client_portal_dashboard_show_last_visit", value: "true" },
  { key: "client_portal_dashboard_show_total_appointments", value: "true" },
  { key: "client_portal_dashboard_show_month_count", value: "true" },
  { key: "client_portal_dashboard_show_next_appointment", value: "true" },
  { key: "client_portal_dashboard_show_recent_history", value: "true" },
  { key: "client_portal_dashboard_history_limit", value: "5" },
  { key: "client_portal_appointments_show_history", value: "true" },
  { key: "client_portal_appointments_history_limit", value: "20" },
  {
    key: "client_portal_empty_dashboard_message",
    value: "Você ainda não possui histórico de agendamentos.",
  },
  {
    key: "client_portal_empty_appointments_message",
    value: "Você ainda não possui agendamentos.",
  },
];

function getNodeEnv() {
  return process.env.NODE_ENV || "development";
}

function getEnvValue(key) {
  const value = process.env[key];

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getDevelopmentUsers() {
  const admin = {
    name: getEnvValue("DEV_ADMIN_NAME") || "Administrador",
    email: getEnvValue("DEV_ADMIN_EMAIL"),
    password: getEnvValue("DEV_ADMIN_PASSWORD"),
    role: "ADMIN",
  };

  const professional = {
    name: getEnvValue("DEV_PROFESSIONAL_NAME") || "Profissional AlphaMen",
    email: getEnvValue("DEV_PROFESSIONAL_EMAIL") || "profissional@alphamen.com",
    password:
      getEnvValue("DEV_PROFESSIONAL_PASSWORD") ||
      getEnvValue("DEV_DEFAULT_PASSWORD"),
    role: "PROFESSIONAL",
  };

  const client = {
    name: getEnvValue("DEV_CLIENT_NAME") || "Cliente AlphaMen",
    email: getEnvValue("DEV_CLIENT_EMAIL") || "cliente@alphamen.com",
    password:
      getEnvValue("DEV_CLIENT_PASSWORD") || getEnvValue("DEV_DEFAULT_PASSWORD"),
    role: "CLIENT",
  };

  const missing = [];

  if (!admin.email) {
    missing.push("DEV_ADMIN_EMAIL");
  }

  if (!admin.password) {
    missing.push("DEV_ADMIN_PASSWORD");
  }

  if (!professional.password) {
    missing.push("DEV_PROFESSIONAL_PASSWORD ou DEV_DEFAULT_PASSWORD");
  }

  if (!client.password) {
    missing.push("DEV_CLIENT_PASSWORD ou DEV_DEFAULT_PASSWORD");
  }

  if (missing.length > 0) {
    throw new Error(
      `Em desenvolvimento, defina estas variáveis no backend/.env antes de rodar o seed: ${missing.join(", ")}.`,
    );
  }

  return [admin, professional, client];
}

function getRequiredProductionAdmin() {
  const name = getEnvValue("INITIAL_ADMIN_NAME");
  const email = getEnvValue("INITIAL_ADMIN_EMAIL");
  const password = getEnvValue("INITIAL_ADMIN_PASSWORD");

  if (!name || !email || !password) {
    throw new Error(
      "Em produção, defina INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD.",
    );
  }

  return { name, email, password };
}

async function seedDefaultSettings() {
  for (const { key, value } of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }
}

async function upsertUser({ name, email, password, role }) {
  const passwordHash = await hashPassword(password);

  return prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      role,
      status: "ACTIVE",
      deletedAt: null,
    },
    create: {
      name,
      email,
      passwordHash,
      role,
      status: "ACTIVE",
    },
  });
}

async function upsertProfessionalProfile(user) {
  return prisma.professional.upsert({
    where: { userId: user.id },
    update: {
      name: user.name,
      phone: "(11) 99999-0001",
      specialty: "Cortes premium",
      status: "ACTIVE",
      deletedAt: null,
    },
    create: {
      userId: user.id,
      name: user.name,
      phone: "(11) 99999-0001",
      specialty: "Cortes premium",
      status: "ACTIVE",
    },
  });
}

async function upsertClientProfile(user) {
  return prisma.client.upsert({
    where: { userId: user.id },
    update: {
      name: user.name,
      phone: "(11) 99999-0002",
      email: user.email,
      status: "ACTIVE",
      deletedAt: null,
    },
    create: {
      userId: user.id,
      name: user.name,
      phone: "(11) 99999-0002",
      email: user.email,
      status: "ACTIVE",
    },
  });
}

async function seedDevelopmentUsers() {
  const [adminInput, professionalInput, clientInput] = getDevelopmentUsers();
  const admin = await upsertUser(adminInput);
  const professionalUser = await upsertUser(professionalInput);
  const clientUser = await upsertUser(clientInput);

  await upsertProfessionalProfile(professionalUser);
  await upsertClientProfile(clientUser);

  console.log("Contas de desenvolvimento preparadas:");
  console.log(`- ADMIN: ${admin.email}`);
  console.log(`- PROFESSIONAL: ${professionalUser.email}`);
  console.log(`- CLIENT: ${clientUser.email}`);
  console.log("Credenciais carregadas do backend/.env");
}

async function seedProductionAdmin() {
  const adminInput = getRequiredProductionAdmin();
  const admin = await upsertUser({
    ...adminInput,
    role: "ADMIN",
  });

  console.log(`Admin inicial preparado: ${admin.email}`);
}

const defaultPaymentMethods = [
  { code: "PIX", name: "PIX", displayOrder: 1 },
  { code: "CASH", name: "Dinheiro", displayOrder: 2 },
  { code: "DEBIT_CARD", name: "Cartão de débito", displayOrder: 3 },
  { code: "CREDIT_CARD", name: "Cartão de crédito", displayOrder: 4 },
  { code: "OTHER", name: "Outro", displayOrder: 5 },
];

async function seedPaymentMethods() {
  for (const method of defaultPaymentMethods) {
    await prisma.paymentMethodConfig.upsert({
      where: { code: method.code },
      update: { name: method.name, displayOrder: method.displayOrder, isActive: true },
      create: method,
    });
  }

  console.log(`Payment methods seeded: ${defaultPaymentMethods.length} methods`);
}

async function backfillPaymentMethodIds() {
  const payments = await prisma.payment.findMany({
    where: { paymentMethod: { not: null }, paymentMethodId: null },
    select: { id: true, paymentMethod: true },
  });

  if (payments.length === 0) return;

  const configs = await prisma.paymentMethodConfig.findMany({
    select: { id: true, code: true },
  });

  const codeToId = Object.fromEntries(configs.map((c) => [c.code, c.id]));
  const fallback = codeToId["OTHER"] ?? null;

  for (const payment of payments) {
    const paymentMethodId = codeToId[payment.paymentMethod] ?? fallback;
    if (paymentMethodId) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { paymentMethodId },
      });
    }
  }

  console.log(`Backfilled paymentMethodId for ${payments.length} payment(s)`);
}

async function main() {
  const nodeEnv = getNodeEnv();

  await seedDefaultSettings();
  await seedPaymentMethods();
  await backfillPaymentMethodIds();

  if (nodeEnv === "production") {
    await seedProductionAdmin();
  } else {
    await seedDevelopmentUsers();
  }

  console.log(`Default settings seeded: ${defaultSettings.length} keys`);
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
