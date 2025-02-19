import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertConfigSchema, insertEnvironmentFeatureSchema } from "@shared/schema";
import { aiService } from "./services/ai";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/agents", async (_req, res) => {
    const agents = await storage.getAgents();
    res.json(agents);
  });

  app.get("/api/config", async (_req, res) => {
    const config = await storage.getConfig();
    res.json(config);
  });

  app.post("/api/config", async (req, res) => {
    const parsed = insertConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid config" });
      return;
    }

    const config = await storage.updateConfig(parsed.data);
    res.json(config);
  });

  app.get("/api/environment", async (_req, res) => {
    const features = await storage.getEnvironmentFeatures();
    res.json(features);
  });

  app.post("/api/environment", async (req, res) => {
    const parsed = insertEnvironmentFeatureSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid environment feature" });
      return;
    }

    const feature = await storage.addEnvironmentFeature(parsed.data);
    res.json(feature);
  });

  app.post("/api/agents/:id/decision", async (req, res) => {
    const agentId = parseInt(req.params.id);
    if (isNaN(agentId)) {
      res.status(400).json({ error: "Invalid agent ID" });
      return;
    }

    try {
      const { memory = { interactions: [] }, ...rest } = req.body;
      const decision = await aiService.getAgentDecision({
        id: agentId,
        memory,
        ...rest
      });
      res.json(decision);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error getting agent decision:", errorMessage);
      res.status(500).json({ error: errorMessage });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}