import colors from "colors";
import { Partner } from "../app/modules/partner/partner.model";
import { logger } from "../shared/logger";

const DEFAULT_PARTNERS = [
  {
    name: "Sixt",
    companyCode: "SX",
    logoUrl: "https://ui-avatars.com/api/?name=Sixt&background=FF5F00&color=fff&size=128&bold=true",
    sortOrder: 1,
  },
  {
    name: "Hertz",
    companyCode: "ZE",
    logoUrl: "https://ui-avatars.com/api/?name=Hertz&background=FFCC00&color=111&size=128&bold=true",
    sortOrder: 2,
  },
  {
    name: "Avis",
    companyCode: "ZI",
    logoUrl: "https://ui-avatars.com/api/?name=Avis&background=D4002A&color=fff&size=128&bold=true",
    sortOrder: 3,
  },
  {
    name: "Budget",
    companyCode: "ZD",
    logoUrl: "https://ui-avatars.com/api/?name=Budget&background=003B95&color=fff&size=128&bold=true",
    sortOrder: 4,
  },
  {
    name: "Enterprise",
    companyCode: "ET",
    logoUrl: "https://ui-avatars.com/api/?name=Enterprise&background=2B8A3E&color=fff&size=128&bold=true",
    sortOrder: 5,
  },
  {
    name: "Europcar",
    companyCode: "EP",
    logoUrl: "https://ui-avatars.com/api/?name=Europcar&background=0B3D91&color=fff&size=128&bold=true",
    sortOrder: 6,
  },
];

export const seedPartners = async () => {
  const count = await Partner.countDocuments();
  if (count > 0) return;

  await Partner.insertMany(
    DEFAULT_PARTNERS.map((p) => ({ ...p, isActive: true }))
  );
  logger.info(colors.green("✔ Trusted partners seeded successfully!"));
};
