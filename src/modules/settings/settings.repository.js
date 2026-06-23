import prisma from "../../database/prisma.js";

export function getByKey(key) {
  return prisma.systemSetting.findUnique({ where: { key } });
}

export function getMany(keys) {
  return prisma.systemSetting.findMany({ where: { key: { in: keys } } });
}

export function upsert(key, value) {
  return prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export function upsertMany(pairs) {
  return prisma.$transaction(
    pairs.map(({ key, value }) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );
}
