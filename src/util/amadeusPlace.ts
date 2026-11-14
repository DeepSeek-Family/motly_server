/**
 * Metropolitan IATA city codes (not airport stations).
 * Sending these as subtype=AIRPORT makes Amadeus return 8324/32373 walls.
 */
const METRO_CITY_CODES = new Set([
  "LON",
  "NYC",
  "PAR",
  "ROM",
  "MIL",
  "STO",
  "WAS",
  "CHI",
  "YTO",
  "YMQ",
  "TYO",
  "OSA",
  "SEL",
  "BJS",
  "SHA",
  "RIO",
  "SAO",
  "BUE",
  "MEX",
  "MOW",
  "IEV",
  "BUH",
  "WAW",
  "QSF",
]);

export const isMetroCityCode = (iataCode?: string | null): boolean => {
  if (!iataCode) return false;
  return METRO_CITY_CODES.has(iataCode.trim().toUpperCase());
};

export const isSoftAmadeusSearchFailure = (message: string): boolean => {
  const text = message || "";
  return (
    text.includes("8324") ||
    text.includes("32373") ||
    /PLS SPECIFY AIRPORT OR USE CL/i.test(text) ||
    /PROVIDER DOES NOT OPERATE/i.test(text)
  );
};

export const shortenAmadeusSearchError = (message: string): string => {
  if (!isSoftAmadeusSearchFailure(message)) {
    return message.length > 280 ? `${message.slice(0, 280)}…` : message;
  }

  return (
    "No car offers for this place/dates. " +
    "Use an airport code (e.g. LHR, CDG, JFK) or a city code with CITY mode (e.g. LON, PAR, NYC)."
  );
};

type Loc = {
  subtype?: string;
  iataCode?: string;
  geoCode?: unknown;
};

/** Prefer CITY for metro codes; keep explicit client CITY; otherwise AIRPORT. */
export const resolveIataSubtype = (
  location: Loc | undefined
): "AIRPORT" | "CITY" | undefined => {
  if (!location?.iataCode) return undefined;
  if (location.subtype === "CITY") return "CITY";
  if (isMetroCityCode(location.iataCode)) return "CITY";
  if (location.subtype === "AIRPORT") return "AIRPORT";
  return "AIRPORT";
};

export const withLocationSubtype = <T extends Record<string, any>>(
  body: T,
  subtype: "AIRPORT" | "CITY"
): T => {
  const pickUp = (body.pickUp || {}) as Record<string, any>;
  const location = (pickUp.location || {}) as Record<string, any>;
  if (!location.iataCode) return body;

  return {
    ...body,
    pickUp: {
      ...pickUp,
      location: {
        ...location,
        subtype,
      },
    },
  };
};
