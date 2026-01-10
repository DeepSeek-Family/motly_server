import { Request } from "express";
import { getMultipleFilesPath } from "../shared/getFilePath";
import { carClass } from "../enums/carClass";
import { fuelType } from "../enums/fuelType";
import { bookingStatus } from "../enums/bookingStatus";
import { transmission } from "../types/transmission";

export const parseCarPayload = (req: Request) => {
  const { body } = req;
  const carImages = getMultipleFilesPath(req.files, "carImages");

  // Parse location
  let lat: number | undefined;
  let lon: number | undefined;

  if (body.location) {
    try {
      const locationObj =
        typeof body.location === "string"
          ? JSON.parse(body.location)
          : body.location;

      lat = parseFloat(locationObj.lat);
      lon = parseFloat(locationObj.lon);
    } catch (error) {
      throw new Error(
        "Invalid location format. 'location' must be a valid JSON with 'lat' and 'lon'."
      );
    }
  }

  if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) {
    throw new Error(
      "Invalid location coordinates. Please provide valid 'lat' and 'lon' numbers."
    );
  }

  const geoLocation = {
    type: "Point",
    coordinates: [lon, lat], // MongoDB expects [longitude, latitude]
  };

  return {
    name: body.name,
    class: body.class as carClass,
    doors: Number(body.doors),
    seats: Number(body.seats),
    suitcases: Number(body.suitcases),
    transmission: body.transmission as transmission,
    airCondition: body.airCondition === "true" || body.airCondition === true,
    fuelPolicy: body.fuelPolicy as fuelType,
    kilometers: Number(body.kilometers),
    description: body.description,
    pricePerDay: Number(body.pricePerDay),
    bookingStatus: body.bookingStatus || bookingStatus.Pending,
    location: geoLocation, // GeoJSON
    carImages,
    rating: body.rating ? Number(body.rating) : undefined,
    insurance: body.insurance,
    milegLimit: body.milegLimit ? Number(body.milegLimit) : 0,
  };
};
