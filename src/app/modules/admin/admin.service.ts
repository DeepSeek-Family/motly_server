import { StatusCodes } from "http-status-codes";
import { Types } from "mongoose";
import ApiError from "../../../errors/ApiErrors";
import { USER_ROLES } from "../../../enums/user";
import { User } from "../user/user.model";
import { CarModel } from "../car/car.model";
import { CarAmadeusOrderModel } from "../car/carOrder.model";
import {
  CarPaymentModel,
  CarPaymentStatus,
} from "../car/carPayment.model";
import { CarAmadeusOrderStatus } from "../car/car.interface";
import { mapLedgerBookingSummary } from "../../../util/carAmadeusMapper";
import { Partner } from "../partner/partner.model";
import { redisDel } from "../../../helpers/redisHelper";

const PARTNERS_PUBLIC_CACHE_KEY = "partners:public:active";
const invalidatePartnerPublicCache = async () => {
  await redisDel(PARTNERS_PUBLIC_CACHE_KEY);
};

type ListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
};

const pageLimit = (query: ListQuery) => {
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit =
    query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
  return { page, limit, skip: (page - 1) * limit };
};

const mapBookingAdminStatus = (status?: string) => {
  switch ((status || "").toUpperCase()) {
    case CarAmadeusOrderStatus.VOUCHER_ISSUED:
      // FE BookingStatus uses the typo "Runing"
      return "Runing";
    case CarAmadeusOrderStatus.CANCELLED:
      return "Completed";
    case CarAmadeusOrderStatus.CREATED:
    default:
      return "Upcoming";
  }
};

const getDashboardOverview = async (query?: {
  from?: string;
  to?: string;
}) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const from = query?.from ? new Date(query.from) : null;
  const to = query?.to ? new Date(query.to) : null;
  if (to) to.setHours(23, 59, 59, 999);

  const dateFilter =
    from || to
      ? {
          createdAt: {
            ...(from && !Number.isNaN(from.getTime()) ? { $gte: from } : {}),
            ...(to && !Number.isNaN(to.getTime()) ? { $lte: to } : {}),
          },
        }
      : {};

  const [
    totalUsers,
    totalAgencies,
    totalCars,
    totalBookings,
    upcomingBookings,
    runningBookings,
    cancelledBookings,
    succeededPayments,
    monthPayments,
    prevMonthPayments,
    recentBookings,
    recentPayments,
  ] = await Promise.all([
    User.countDocuments({ role: USER_ROLES.USER }),
    User.countDocuments({ role: USER_ROLES.AGENCY }),
    CarModel.countDocuments({}),
    CarAmadeusOrderModel.countDocuments(dateFilter),
    CarAmadeusOrderModel.countDocuments({
      status: CarAmadeusOrderStatus.CREATED,
      ...dateFilter,
    }),
    CarAmadeusOrderModel.countDocuments({
      status: CarAmadeusOrderStatus.VOUCHER_ISSUED,
      ...dateFilter,
    }),
    CarAmadeusOrderModel.countDocuments({
      status: CarAmadeusOrderStatus.CANCELLED,
      ...dateFilter,
    }),
    CarPaymentModel.find({
      status: CarPaymentStatus.SUCCEEDED,
      ...dateFilter,
    })
      .select("amount currencyCode createdAt")
      .lean(),
    CarPaymentModel.find({
      status: CarPaymentStatus.SUCCEEDED,
      createdAt: { $gte: startOfMonth },
    })
      .select("amount")
      .lean(),
    CarPaymentModel.find({
      status: CarPaymentStatus.SUCCEEDED,
      createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth },
    })
      .select("amount")
      .lean(),
    CarAmadeusOrderModel.find(dateFilter)
      .sort({ createdAt: -1 })
      .limit(8)
      .populate("user", "name email")
      .lean(),
    CarPaymentModel.find(dateFilter)
      .sort({ createdAt: -1 })
      .limit(8)
      .populate("user", "name email")
      .lean(),
  ]);

  const sumAmounts = (rows: Array<{ amount?: string }>) =>
    rows.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);

  const currencyCounts = new Map<string, number>();
  (succeededPayments as any[]).forEach((p) => {
    const code = String(p.currencyCode || "EUR").toUpperCase();
    currencyCounts.set(code, (currencyCounts.get(code) || 0) + 1);
  });
  let revenueCurrency = "EUR";
  let maxCount = 0;
  currencyCounts.forEach((count, code) => {
    if (count > maxCount) {
      maxCount = count;
      revenueCurrency = code;
    }
  });

  const totalRevenue = sumAmounts(succeededPayments as any);
  const monthRevenue = sumAmounts(monthPayments as any);
  const prevMonthRevenue = sumAmounts(prevMonthPayments as any);
  const revenueGrowth =
    prevMonthRevenue > 0
      ? ((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100
      : monthRevenue > 0
        ? 100
        : 0;

  // Last 6 months revenue series
  const months: Array<{ key: string; label: string; revenue: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      key,
      label: d.toLocaleString("en", { month: "short" }),
      revenue: 0,
    });
    const monthRows = (succeededPayments as any[]).filter((p) => {
      const created = new Date(p.createdAt);
      return created >= d && created < next;
    });
    months[months.length - 1].revenue = sumAmounts(monthRows);
  }

  return {
    stats: {
      totalUsers,
      totalAgencies,
      totalCars,
      totalBookings,
      upcomingBookings,
      runningBookings,
      cancelledBookings,
      totalRevenue,
      monthRevenue,
      revenueCurrency,
      revenueGrowth: Number(revenueGrowth.toFixed(1)),
      succeededPayments: succeededPayments.length,
    },
    revenueByMonth: months,
    recentBookings: recentBookings.map((row: any) => {
      const summary = mapLedgerBookingSummary(row);
      return {
        ...summary,
        uiStatus: mapBookingAdminStatus(row.status),
        userName: row.user?.name || "",
        userEmail: row.user?.email || "",
      };
    }),
    recentPayments: recentPayments.map((row: any) => ({
      id: String(row._id),
      paymentIntentId: row.paymentIntentId,
      amount: row.amount,
      currencyCode: row.currencyCode,
      status: row.status,
      driverEmail: row.driverEmail,
      userName: row.user?.name || "",
      userEmail: row.user?.email || "",
      createdAt: row.createdAt,
    })),
  };
};

const listBookings = async (query: ListQuery) => {
  const { page, limit, skip } = pageLimit(query);
  const filter: Record<string, unknown> = {};

  if (query.status) {
    const s = query.status.toUpperCase();
    if (s === "UPCOMING") filter.status = CarAmadeusOrderStatus.CREATED;
    else if (s === "RUNNING" || s === "RUNING")
      filter.status = CarAmadeusOrderStatus.VOUCHER_ISSUED;
    else if (s === "CANCELED" || s === "CANCELLED")
      filter.status = CarAmadeusOrderStatus.CANCELLED;
    else filter.status = query.status;
  }

  if (query.search?.trim()) {
    const q = query.search.trim();
    filter.$or = [
      { "driver.firstName": { $regex: q, $options: "i" } },
      { "driver.lastName": { $regex: q, $options: "i" } },
      { "driver.email": { $regex: q, $options: "i" } },
      { "driver.phone": { $regex: q, $options: "i" } },
      { confirmationNumber: { $regex: q, $options: "i" } },
      { pnrRecordReference: { $regex: q, $options: "i" } },
      { offerId: { $regex: q, $options: "i" } },
    ];
  }

  const [rows, total] = await Promise.all([
    CarAmadeusOrderModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "name email contact")
      .lean(),
    CarAmadeusOrderModel.countDocuments(filter),
  ]);

  // Payment status lookup
  const ledgerIds = rows.map((r) => r._id);
  const payments = await CarPaymentModel.find({
    bookingLedgerId: { $in: ledgerIds },
  })
    .select("bookingLedgerId status amount currencyCode paymentIntentId")
    .lean();
  const paymentByLedger = new Map(
    payments.map((p) => [String(p.bookingLedgerId), p])
  );

  const data = rows.map((row: any) => {
    const summary = mapLedgerBookingSummary(row);
    const payment = paymentByLedger.get(String(row._id));
    return {
      id: summary.ledgerId,
      ledgerId: summary.ledgerId,
      startDate: summary.pickupDateTime || summary.createdAt,
      endDate: summary.dropoffDateTime || summary.updatedAt,
      clientName:
        [row.driver?.firstName, row.driver?.lastName]
          .filter(Boolean)
          .join(" ") ||
        row.user?.name ||
        "—",
      clientEmail: row.driver?.email || row.user?.email || "",
      clientPhone: row.driver?.phone || row.user?.contact || "",
      carModel: summary.model || summary.vehicleCategory || "Car",
      carName: summary.model || summary.companyName || "Car booking",
      carImage: summary.imageUrl || "",
      licensePlate: summary.acrissCode || summary.companyCode || "—",
      plan: summary.vehicleCategory || summary.acrissCode || "Amadeus",
      payment: payment
        ? `${payment.currencyCode || summary.currencyCode || ""} ${payment.amount || summary.totalAmount || ""}`.trim()
        : `${summary.currencyCode || ""} ${summary.totalAmount || ""}`.trim(),
      paymentStatus:
        payment?.status === CarPaymentStatus.SUCCEEDED ? "Paid" : "Pending",
      status: mapBookingAdminStatus(row.status),
      confirmationNumber: summary.confirmationNumber,
      pnrRecordReference: summary.pnrRecordReference,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
      offerId: summary.offerId,
      companyName: summary.companyName,
      source: "amadeus_order",
    };
  });

  // Paid Checkout with no Amadeus order yet still shows in Booking Management.
  const includeOrphanPayments =
    !query.status ||
    ["UPCOMING", "ALL"].includes(String(query.status).toUpperCase());

  let orphanRows: any[] = [];
  if (includeOrphanPayments && page === 1) {
    const orphanFilter: Record<string, unknown> = {
      status: CarPaymentStatus.SUCCEEDED,
      $or: [
        { bookingLedgerId: { $exists: false } },
        { bookingLedgerId: null },
      ],
    };
    if (query.search?.trim()) {
      const q = query.search.trim();
      orphanFilter.$and = [
        {
          $or: [
            { driverEmail: { $regex: q, $options: "i" } },
            { offerId: { $regex: q, $options: "i" } },
            { paymentIntentId: { $regex: q, $options: "i" } },
          ],
        },
      ];
    }
    orphanRows = await CarPaymentModel.find(orphanFilter)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("user", "name email contact")
      .lean();
  }

  const orphanData = orphanRows.map((row: any) => {
    const snap =
      row.metadata &&
      typeof row.metadata === "object" &&
      (row.metadata as any).offerSnapshot
        ? (row.metadata as any).offerSnapshot
        : {};
    return {
      id: `pay_${row._id}`,
      ledgerId: undefined,
      paymentId: String(row._id),
      startDate: snap.pickupDateTime || row.createdAt,
      endDate: snap.dropoffDateTime || row.updatedAt || row.createdAt,
      clientName: row.user?.name || row.driverEmail || "—",
      clientEmail: row.user?.email || row.driverEmail || "",
      clientPhone: row.user?.contact || "",
      carModel: snap.model || "Car",
      carName: snap.model || snap.companyName || "Paid — booking pending",
      carImage: snap.imageUrl || "",
      licensePlate: snap.acrissCode || "—",
      plan: snap.vehicleCategory || snap.companyName || "Amadeus",
      payment: `${row.currencyCode || ""} ${row.amount || ""}`.trim(),
      paymentStatus: "Paid",
      status: "Upcoming",
      confirmationNumber: undefined,
      pnrRecordReference: undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt || row.createdAt,
      offerId: row.offerId,
      companyName: snap.companyName || "",
      source: "payment_pending_booking",
    };
  });

  const merged = [...orphanData, ...data];
  const totalWithOrphans = total + orphanData.length;

  return {
    data: merged.slice(0, limit),
    pagination: {
      page,
      limit,
      total: totalWithOrphans,
      totalPage: Math.ceil(totalWithOrphans / limit) || 1,
    },
  };
};

const mapPaymentAdminStatus = (s: string) => {
  switch (s) {
    case CarPaymentStatus.SUCCEEDED:
      return "Completed";
    case CarPaymentStatus.FAILED:
      return "Failed";
    case CarPaymentStatus.REFUNDED:
      return "Cancelled";
    case CarPaymentStatus.PROCESSING:
    case CarPaymentStatus.REQUIRES_PAYMENT:
    default:
      return "Pending";
  }
};

/** Short Motly-facing id — never use Stripe cs_/pi_/sk_ as the primary label. */
const toMotlyTransactionId = (mongoId: string) =>
  `TXN-${String(mongoId).slice(-8).toUpperCase()}`;

const mapPaymentAdminRow = (row: any) => {
  const snap =
    row.metadata &&
    typeof row.metadata === "object" &&
    row.metadata.offerSnapshot &&
    typeof row.metadata.offerSnapshot === "object"
      ? (row.metadata.offerSnapshot as Record<string, unknown>)
      : null;
  const model = snap && typeof snap.model === "string" ? snap.model : "";
  const company =
    snap && typeof snap.companyName === "string" ? snap.companyName : "";
  const descriptionParts = [
    row.offerId ? `Offer ${row.offerId}` : "",
    model,
    company,
  ].filter(Boolean);

  const mongoId = String(row._id);
  const checkoutSessionId =
    row.checkoutSessionId ||
    (typeof row.paymentIntentId === "string" &&
    row.paymentIntentId.startsWith("cs_")
      ? row.paymentIntentId
      : undefined);

  return {
    id: mongoId,
    /** Human Motly transaction code shown in admin UI */
    transactionId: toMotlyTransactionId(mongoId),
    date: row.createdAt,
    userName: row.user?.name || row.driverEmail || "—",
    email: row.user?.email || row.driverEmail || "",
    amount: Number(row.amount) || 0,
    currency: row.currencyCode || "EUR",
    status: mapPaymentAdminStatus(row.status),
    paymentMethod: "Stripe Checkout",
    description: descriptionParts.join(" · ") || "Car booking payment",
    offerId: row.offerId,
    bookingLedgerId: row.bookingLedgerId
      ? String(row.bookingLedgerId)
      : undefined,
    stripeStatus: row.stripeStatus,
    /** Stripe Checkout Session id (cs_…) — reference only, not a secret key */
    stripeSessionId: checkoutSessionId,
    stripePaymentIntentId: row.stripePaymentIntentId || undefined,
    checkoutSessionId,
    driverEmail: row.driverEmail || undefined,
    refundId: row.refundId || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt || row.createdAt,
  };
};

const listPayments = async (query: ListQuery) => {
  const { page, limit, skip } = pageLimit(query);
  const filter: Record<string, unknown> = {};

  if (query.status) {
    filter.status = query.status.toUpperCase();
  }

  if (query.search?.trim()) {
    const q = query.search.trim();
    filter.$or = [
      { driverEmail: { $regex: q, $options: "i" } },
      { paymentIntentId: { $regex: q, $options: "i" } },
      { offerId: { $regex: q, $options: "i" } },
      { stripePaymentIntentId: { $regex: q, $options: "i" } },
    ];
  }

  const [rows, total] = await Promise.all([
    CarPaymentModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "name email")
      .lean(),
    CarPaymentModel.countDocuments(filter),
  ]);

  const data = rows.map((row: any) => mapPaymentAdminRow(row));

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit) || 1,
    },
  };
};

const getPaymentById = async (id: string) => {
  if (!id?.trim()) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Payment id is required");
  }

  const or: Record<string, unknown>[] = [
    { paymentIntentId: id },
    { checkoutSessionId: id },
    { stripePaymentIntentId: id },
  ];
  if (Types.ObjectId.isValid(id)) {
    or.unshift({ _id: id });
  }

  const row = await CarPaymentModel.findOne({ $or: or })
    .populate("user", "name email")
    .lean();

  if (!row) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Payment not found");
  }

  return mapPaymentAdminRow(row);
};

const listUsersByRole = async (role: USER_ROLES, query: ListQuery) => {
  const { page, limit, skip } = pageLimit(query);
  const filter: Record<string, unknown> = { role };

  if (query.search?.trim()) {
    const q = query.search.trim();
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { contact: { $regex: q, $options: "i" } },
      { country: { $regex: q, $options: "i" } },
    ];
  }

  if (query.status === "verified") filter.verified = true;
  if (query.status === "unverified") filter.verified = false;

  const [rows, total] = await Promise.all([
    User.find(filter)
      .select("-password -confirmPassword -authentication")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  if (role === USER_ROLES.AGENCY) {
    const ids = rows.map((u) => u._id);
    const carCounts = await CarModel.aggregate([
      { $match: { user: { $in: ids } } },
      { $group: { _id: "$user", total: { $sum: 1 } } },
    ]);
    const countMap = new Map(
      carCounts.map((c) => [String(c._id), c.total as number])
    );
    const orderCounts = await CarAmadeusOrderModel.aggregate([
      {
        $match: {
          status: CarAmadeusOrderStatus.VOUCHER_ISSUED,
        },
      },
      // completed orders aren't tied to agency user directly on Amadeus ledger;
      // keep 0 unless we later add agency ownership.
      { $group: { _id: null, total: { $sum: 1 } } },
    ]);
    void orderCounts;

    return {
      data: rows.map((u: any) => ({
        id: String(u._id),
        name: u.name || "",
        ownerName: u.name || "",
        phone: u.contact || "",
        email: u.email || "",
        country: u.country || "",
        address: u.residentialAddress || "",
        totalCars: countMap.get(String(u._id)) || 0,
        completedOrders: 0,
        status: u.verified === false ? "inactive" : "active",
        logo: u.image || "",
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit) || 1,
      },
    };
  }

  return {
    data: rows.map((u: any) => ({
      id: String(u._id),
      name: u.name || "",
      phone: u.contact || "",
      email: u.email || "",
      status: u.verified ? "verified" : "unverified",
      country: u.country || "",
      gender: u.gender || "",
      fullAddress: u.residentialAddress || "",
      licenseNumber: u.drivingDetails?.licenseNumber
        ? String(u.drivingDetails.licenseNumber)
        : "",
      avatar: u.image || "",
      photo: u.image || "",
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit) || 1,
    },
  };
};

const listCalendar = async (query: {
  from?: string;
  to?: string;
}) => {
  const from = query.from ? new Date(query.from) : new Date();
  from.setHours(0, 0, 0, 0);
  const to = query.to
    ? new Date(query.to)
    : new Date(from.getTime() + 9 * 24 * 60 * 60 * 1000);
  to.setHours(23, 59, 59, 999);

  const inRange = (iso?: string | Date | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    return d >= from && d <= to;
  };

  const [orderRows, paymentRows] = await Promise.all([
    CarAmadeusOrderModel.find({})
      .sort({ createdAt: -1 })
      .limit(500)
      .lean(),
    CarPaymentModel.find({
      status: {
        $in: [CarPaymentStatus.SUCCEEDED, CarPaymentStatus.PROCESSING],
      },
    })
      .sort({ createdAt: -1 })
      .limit(500)
      .populate("user", "name email")
      .lean(),
  ]);

  const fromOrders = orderRows.map((row: any) => {
    const summary = mapLedgerBookingSummary(row);
    const start = summary.pickupDateTime || summary.createdAt;
    const end = summary.dropoffDateTime || summary.updatedAt;
    return {
      id: summary.ledgerId,
      title: summary.model || summary.companyName || "Booking",
      clientName: [row.driver?.firstName, row.driver?.lastName]
        .filter(Boolean)
        .join(" "),
      start,
      end,
      status: mapBookingAdminStatus(row.status),
    };
  });

  const fromPayments = paymentRows
    .filter((row: any) => !row.bookingLedgerId)
    .map((row: any) => {
      const snap =
        row.metadata &&
        typeof row.metadata === "object" &&
        (row.metadata as any).offerSnapshot
          ? (row.metadata as any).offerSnapshot
          : {};
      return {
        id: `pay_${row._id}`,
        title: snap.model || snap.companyName || "Paid booking",
        clientName: row.user?.name || row.driverEmail || "—",
        start: snap.pickupDateTime || row.createdAt,
        end: snap.dropoffDateTime || row.updatedAt || row.createdAt,
        status: "Upcoming",
      };
    });

  // Amadeus orders + paid Checkout that never finished Amadeus book step.
  return [...fromOrders, ...fromPayments]
    .filter((event) => inRange(event.start) || inRange(event.end))
    .sort(
      (a, b) =>
        new Date(a.start || 0).getTime() - new Date(b.start || 0).getTime()
    );
};

const mapPartnerAdminRow = (p: any) => ({
  id: String(p._id),
  name: p.name,
  companyCode: p.companyCode || "",
  logoUrl: p.logoUrl || "",
  logo: p.logoUrl || "",
  websiteUrl: p.websiteUrl || "",
  isActive: Boolean(p.isActive),
  status: p.isActive ? "active" : "inactive",
  sortOrder: p.sortOrder ?? 0,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

const listPartnersAdmin = async () => {
  const rows = await Partner.find({}).sort({ sortOrder: 1, createdAt: -1 }).lean();
  return rows.map(mapPartnerAdminRow);
};

const createPartnerAdmin = async (payload: {
  name: string;
  companyCode?: string;
  logoUrl: string;
  websiteUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
}) => {
  const name = String(payload.name || "").trim();
  const logoUrl = String(payload.logoUrl || "").trim();
  if (!name) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Partner name is required");
  }
  if (!logoUrl) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Partner logo is required (upload an image)"
    );
  }
  const created = await Partner.create({
    name,
    companyCode: payload.companyCode
      ? String(payload.companyCode).trim().toUpperCase()
      : undefined,
    logoUrl,
    websiteUrl: payload.websiteUrl
      ? String(payload.websiteUrl).trim()
      : undefined,
    isActive: payload.isActive !== false,
    sortOrder: Number.isFinite(Number(payload.sortOrder))
      ? Number(payload.sortOrder)
      : 0,
  });
  await invalidatePartnerPublicCache();
  return mapPartnerAdminRow(created.toObject());
};

const updatePartnerAdmin = async (
  id: string,
  payload: {
    name?: string;
    companyCode?: string;
    logoUrl?: string;
    websiteUrl?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }
) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid partner id");
  }
  const update: Record<string, unknown> = {};
  if (payload.name !== undefined) update.name = String(payload.name).trim();
  if (payload.companyCode !== undefined) {
    update.companyCode = String(payload.companyCode).trim().toUpperCase();
  }
  if (payload.logoUrl !== undefined) {
    update.logoUrl = String(payload.logoUrl).trim();
  }
  if (payload.websiteUrl !== undefined) {
    update.websiteUrl =
      payload.websiteUrl === null || payload.websiteUrl === ""
        ? undefined
        : String(payload.websiteUrl).trim();
  }
  if (payload.isActive !== undefined) update.isActive = Boolean(payload.isActive);
  if (payload.sortOrder !== undefined) {
    update.sortOrder = Number(payload.sortOrder) || 0;
  }

  const updated = await Partner.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  }).lean();
  if (!updated) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Partner not found");
  }
  await invalidatePartnerPublicCache();
  return mapPartnerAdminRow(updated);
};

const deletePartnerAdmin = async (id: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid partner id");
  }
  const deleted = await Partner.findByIdAndDelete(id).lean();
  if (!deleted) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Partner not found");
  }
  await invalidatePartnerPublicCache();
  return mapPartnerAdminRow(deleted);
};

const setUserVerified = async (id: string, verified: boolean) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid user id");
  }
  const user = await User.findByIdAndUpdate(
    id,
    { verified },
    { new: true }
  )
    .select("-password -confirmPassword -authentication")
    .lean();
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }
  return user;
};

export const AdminService = {
  getDashboardOverview,
  listBookings,
  listPayments,
  getPaymentById,
  listClients: (query: ListQuery) => listUsersByRole(USER_ROLES.USER, query),
  listAgencies: (query: ListQuery) =>
    listUsersByRole(USER_ROLES.AGENCY, query),
  listCalendar,
  listPartnersAdmin,
  createPartnerAdmin,
  updatePartnerAdmin,
  deletePartnerAdmin,
  setUserVerified,
};
