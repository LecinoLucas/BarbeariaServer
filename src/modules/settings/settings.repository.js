import prisma from "../../database/prisma.js";

const systemSettingSelect = {
  id: true,
  key: true,
  value: true,
  createdAt: true,
  updatedAt: true,
};

export function getByKey(key) {
  return prisma.systemSetting.findUnique({
    where: { key },
    select: systemSettingSelect,
  });
}

export function getMany(keys) {
  return prisma.systemSetting.findMany({
    where: { key: { in: keys } },
    select: systemSettingSelect,
  });
}

export function upsert(key, value) {
  return prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
    select: systemSettingSelect,
  });
}

export function upsertMany(pairs) {
  return prisma.$transaction(
    pairs.map(({ key, value }) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
        select: systemSettingSelect,
      })
    )
  );
}
