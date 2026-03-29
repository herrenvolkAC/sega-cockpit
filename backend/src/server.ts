import Fastify from "fastify";
import { config } from "./config";
import { healthRoute } from "./routes/health";
import { statusRoute } from "./routes/status";
import { detailRoute } from "./routes/detail";
import { fulfillmentRoute } from "./routes/fulfillment";
import { productivityRoute } from "./routes/productivity";
import recepcionesRoute from "./routes/recepciones";
import { stockRoute } from "./routes/stock";
import { stockAlmacenajeRoute } from "./routes/stock-almacenaje";
import { expedicionesRoute } from "./routes/expediciones";
import { slottingRoute } from "./routes/slotting";
import { ocupacionRoute } from "./routes/ocupacion";
import { satisfaccionOcRoute } from "./routes/satisfaccion-oc";

const app = Fastify({
  logger: true,
});

app.setErrorHandler((error, request, reply) => {
  request.log.error({
    endpoint: request.url,
    method: request.method,
    error: error.message,
    statusCode: error.statusCode ?? 500,
  });
  const statusCode = error.statusCode ?? 500;
  reply.status(statusCode).send({
    ok: false,
    error: {
      code: statusCode === 400 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR",
      message:
        statusCode < 500
          ? error.message
          : "An unexpected error occurred",
    },
  });
});

const start = async (): Promise<void> => {
  try {
    await app.register(healthRoute);
    await app.register(statusRoute);
    await app.register(detailRoute);
    await app.register(fulfillmentRoute);
    await app.register(productivityRoute);
    await app.register(recepcionesRoute);
    await app.register(stockRoute);
    await app.register(stockAlmacenajeRoute);
    await app.register(expedicionesRoute);
    await app.register(slottingRoute);
    await app.register(ocupacionRoute);
    await app.register(satisfaccionOcRoute);

    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
