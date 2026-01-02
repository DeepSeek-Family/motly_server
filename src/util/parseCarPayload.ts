// src/utils/parseCarPayload.ts
import { Request } from "express";
import { getMultipleFilesPath } from "../shared/getFilePath";
import ApiError from "../errors/ApiErrors";
import { StatusCodes } from "http-status-codes";

interface IParseCarPayloadOptions {
  filesFieldName?: string;
}

const parseCarPayload = (
  req: Request,
  options: IParseCarPayloadOptions = {}
) => {
  const payload = req.body;
  const filesFieldName = options.filesFieldName || "carImages";
  if (!filesFieldName) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `${filesFieldName} is required`
    );
  }

  // Parse uploaded images
  const carImages = getMultipleFilesPath(req.files, filesFieldName as any);

  // Parse location
  let location;
  if (payload.location) {
    location =
      typeof payload.location === "string"
        ? JSON.parse(payload.location)
        : payload.location;

    if (location) {
      location.lat = Number(location.lat);
      location.lon = Number(location.lon);
    }
  }

  // Build parsed payload
  const parsedPayload = {
    ...payload,
    doors: payload.doors ? Number(payload.doors) : undefined,
    suitcases: payload.suitcases ? Number(payload.suitcases) : undefined,
    seats: payload.seats ? Number(payload.seats) : undefined,
    pricePerDay: payload.pricePerDay ? Number(payload.pricePerDay) : undefined,
    kilometers: payload.kilometers ? Number(payload.kilometers) : undefined,
    airCondition:
      payload.airCondition === "true" || payload.airCondition === true
        ? true
        : false,
    location,
    fuelPolicy: payload.fuelPolicy,
    carImages: carImages && carImages.length > 0 ? carImages : undefined,
    user: req.user?.id,
  };

  return parsedPayload;
};

const updateParseCarPayload = (
  req: Request,
  options: IParseCarPayloadOptions = {}
) => {
  const payload = req.body;
  const filesFieldName = options.filesFieldName || "carImages";
  if (!filesFieldName) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `${filesFieldName} is required`
    );
  }

  // Parse uploaded images
  const carImages = getMultipleFilesPath(req.files, filesFieldName as any);
  // Parse location
  let location;
  if (payload.location) {
    location =
      typeof payload.location === "string"
        ? JSON.parse(payload.location)
        : payload.location;

    if (location) {
      location.lat = Number(location.lat);
      location.lon = Number(location.lon);
    }
  }

  // Build parsed payload
  const parsedPayload = {
    ...payload,
    doors: payload.doors ? Number(payload.doors) : undefined,
    suitcases: payload.suitcases ? Number(payload.suitcases) : undefined,
    seats: payload.seats ? Number(payload.seats) : undefined,
    pricePerDay: payload.pricePerDay ? Number(payload.pricePerDay) : undefined,
    kilometers: payload.kilometers ? Number(payload.kilometers) : undefined,

    location,
    fuelPolicy: payload.fuelPolicy,
    carImages: carImages && carImages.length > 0 ? carImages : undefined,
    user: req.user?.id,
  };
  if ("airCondition" in payload) {
    parsedPayload.airCondition =
      payload.airCondition === "true" || payload.airCondition === true
        ? true
        : false;
  }

  return parsedPayload;
};

export const parseCarPayloadForDB = {
  create: parseCarPayload,
  update: updateParseCarPayload,
};
