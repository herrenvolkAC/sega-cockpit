import Fastify from "fastify";
import { config } from "./config";
import { healthRoute } from "./routes/health";
import { statusRoute } from "./routes/status";
import { detailRoute } from "./routes/detail";
import { fulfillmentRoute } from "./routes/fulfillment";

const app = Fastify({
  logger: true,
});

const start = async (): Promise<void> => {
  try {
    await app.register(healthRoute);
    await app.register(statusRoute);
    await app.register(detailRoute);
    await app.register(fulfillmentRoute);

    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
