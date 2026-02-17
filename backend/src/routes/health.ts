import { FastifyInstance } from "fastify";

export const healthRoute = async (app: FastifyInstance): Promise<void> => {
  app.get("/health", async () => {
    return { ok: true };
  });
};
