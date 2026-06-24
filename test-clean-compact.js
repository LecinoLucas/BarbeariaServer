import fs from "fs";
import { renderCleanCompactReceiptPdf } from "./src/modules/attendances/receiptTemplates/cleanCompactReceiptTemplate.js";

const mockAttendance = {
  id: "att-12345678",
  client: { name: "Lucas Lecino", phone: "11999999999" },
  professional: { name: "Barbeiro João" },
  startedAt: "2026-06-23T12:00:00.000Z",
  finishedAt: "2026-06-23T13:00:00.000Z",
  payment: { status: "PAID", paymentMethod: "PIX", paidAt: "2026-06-23T13:05:00.000Z" },
  appointment: { service: { name: "Corte Social", price: 45 } },
  items: [
    { description: "Lavagem Especial", quantity: 1, unitPrice: 15, total: 15 },
  ],
  productItems: [
    { productNameSnapshot: "Pomada Modeladora", quantity: 1, unitPriceCents: 3000, totalPriceCents: 3000 }
  ]
};

const mockSettings = { barbershopName: "ALPHAMEN BARBEARIA" };

const mockTotals = {
  serviceTotalCents: 4500,
  itemsTotalCents: 1500,
  productTotalCents: 3000,
  grandTotalCents: 9000
};

const doc = renderCleanCompactReceiptPdf({
  attendance: mockAttendance,
  settings: mockSettings,
  totals: mockTotals,
});

doc.pipe(fs.createWriteStream("/tmp/exemplo_comprovante_clean.pdf"));
doc.end();
console.log("PDF clean_compact gerado em /tmp/exemplo_comprovante_clean.pdf");
