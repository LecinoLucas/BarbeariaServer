import prisma from "../../database/prisma.js";

const reminderTemplateSelect = {
  id: true,
  type: true,
  channel: true,
  name: true,
  subject: true,
  bodyText: true,
  bodyHtml: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

function buildWhere(filters) {
  const where = {};

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.channel) {
    where.channel = filters.channel;
  }

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  return where;
}

export function listReminderTemplates(filters) {
  return prisma.reminderTemplate.findMany({
    where: buildWhere(filters),
    orderBy: [
      {
        isActive: "desc",
      },
      {
        updatedAt: "desc",
      },
    ],
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    select: reminderTemplateSelect,
  });
}

export function countReminderTemplates(filters) {
  return prisma.reminderTemplate.count({
    where: buildWhere(filters),
  });
}

export function findReminderTemplateById(id) {
  if (!id) {
    return null;
  }

  return prisma.reminderTemplate.findUnique({
    where: { id },
    select: reminderTemplateSelect,
  });
}

export function findActiveReminderTemplate(type, channel) {
  if (!type || !channel) {
    return null;
  }

  return prisma.reminderTemplate.findFirst({
    where: {
      type,
      channel,
      isActive: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: reminderTemplateSelect,
  });
}

export async function createReminderTemplate(data) {
  return prisma.reminderTemplate.create({
    data,
    select: reminderTemplateSelect,
  });
}

export async function updateReminderTemplate(id, data) {
  return prisma.reminderTemplate.update({
    where: { id },
    data,
    select: reminderTemplateSelect,
  });
}

export async function deactivateReminderTemplate(id) {
  return prisma.reminderTemplate.update({
    where: { id },
    data: {
      isActive: false,
    },
    select: reminderTemplateSelect,
  });
}

export async function createReminderTemplateWithActivation(data) {
  return prisma.$transaction(async (tx) => {
    if (data.isActive) {
      await tx.reminderTemplate.updateMany({
        where: {
          type: data.type,
          channel: data.channel,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
    }

    return tx.reminderTemplate.create({
      data,
      select: reminderTemplateSelect,
    });
  });
}

export async function updateReminderTemplateWithActivation(id, current, data) {
  return prisma.$transaction(async (tx) => {
    const nextType = data.type ?? current.type;
    const nextChannel = data.channel ?? current.channel;
    const nextIsActive = data.isActive ?? current.isActive;

    if (nextIsActive) {
      await tx.reminderTemplate.updateMany({
        where: {
          type: nextType,
          channel: nextChannel,
          isActive: true,
          id: {
            not: id,
          },
        },
        data: {
          isActive: false,
        },
      });
    }

    return tx.reminderTemplate.update({
      where: { id },
      data,
      select: reminderTemplateSelect,
    });
  });
}

export async function activateReminderTemplate(id, type, channel) {
  return prisma.$transaction(async (tx) => {
    await tx.reminderTemplate.updateMany({
      where: {
        type,
        channel,
        isActive: true,
        id: {
          not: id,
        },
      },
      data: {
        isActive: false,
      },
    });

    return tx.reminderTemplate.update({
      where: { id },
      data: {
        isActive: true,
      },
      select: reminderTemplateSelect,
    });
  });
}
