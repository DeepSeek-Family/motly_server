import { Worker } from "bullmq";
import { connectionBullMQ } from "../../config/bullMQ.config";
import { CarAmadeusService } from "../modules/car/carAmadeus.service";
import { AmadeusCarOfferSearchBody } from "../modules/car/car.interface";
import { clearInflightSearchJobId } from "../../util/carSearchCache";

const carSearchWorker = new Worker(
  "carSearchQueue",
  async (job) => {
    const body = job.data?.body as AmadeusCarOfferSearchBody;
    const searchHash =
      typeof job.data?.searchHash === "string" ? job.data.searchHash : null;

    if (!body) {
      throw new Error("Missing car search body on job");
    }

    console.log(
      `🚗 Processing car search job ${job.id}${
        searchHash ? ` hash=${searchHash.slice(0, 12)}` : ""
      }`
    );

    try {
      const result = await CarAmadeusService.processSearchJob(body);
      const offers = (result as { offers?: unknown }).offers;
      console.log(
        `✅ Car search job ${job.id} done — offers=${
          Array.isArray(offers) ? offers.length : 0
        }`
      );
      return result;
    } catch (error) {
      if (searchHash) {
        await clearInflightSearchJobId(searchHash);
      }
      console.error(`❌ Car search job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection: connectionBullMQ,
    concurrency: 2,
  }
);

carSearchWorker.on("ready", () => {
  console.log("✅ Car search worker is ready to process jobs");
});

carSearchWorker.on("error", (err) => {
  console.error("❌ Car search worker error:", err);
});

export default carSearchWorker;
