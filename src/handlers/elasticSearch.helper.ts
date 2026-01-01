import { ICar } from "../app/modules/car/car.interface";
import { esClient } from "../config/elasticSearch";
import { logger } from "../shared/logger";

export const CAR_INDEX = "cars";

export const createCarIndex = async (data: ICar) => {
  try {
    const exists = await esClient.indices.exists({
      index: CAR_INDEX,
    });

    if (exists) {
      logger.info(`Index ${CAR_INDEX} already exists`);
      return;
    }

    await esClient.indices.create({
      index: CAR_INDEX,
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
      },
      mappings: {
        properties: {
          name: {
            type: "text",
            fields: {
              keyword: { type: "keyword" },
            },
          },
          class: { type: "keyword" },
          doors: { type: "integer" },
          transmission: { type: "keyword" },
          suitcases: { type: "integer" },
          airCondition: { type: "boolean" },
          seats: { type: "integer" },
          pricePerDay: { type: "double" },

          location: {
            type: "geo_point",
          },

          fuelPolicy: { type: "keyword" },
          kilometers: { type: "integer" },
          image: { type: "keyword" },
          pickupLocationType: { type: "keyword" },
          bookingStatus: { type: "keyword" },
          paymentStatus: { type: "keyword" },

          user: { type: "keyword" },
          createdAt: { type: "date" },
          updatedAt: { type: "date" },
        },
      },
    });
    logger.info("Car index created successfully");
  } catch (error) {
    console.log(error.message);
    logger.error("Error creating Car index", error);
  }
};
