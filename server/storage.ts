import { type Agent, type SwarmConfig, type InsertAgent, type InsertSwarmConfig, type EnvironmentFeature, type InsertEnvironmentFeature } from "@shared/schema";
import { db } from "./db";
import { agents, swarmConfig, environmentFeatures } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getAgents(): Promise<Agent[]>;
  getConfig(): Promise<SwarmConfig>;
  updateConfig(config: InsertSwarmConfig): Promise<SwarmConfig>;
  getEnvironmentFeatures(): Promise<EnvironmentFeature[]>;
  addEnvironmentFeature(feature: InsertEnvironmentFeature): Promise<EnvironmentFeature>;
  updateAgentSensors(agentId: number, sensors: Agent['sensors']): Promise<Agent>;
  initializeResources(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getAgents(): Promise<Agent[]> {
    return await db.select().from(agents);
  }

  async getConfig(): Promise<SwarmConfig> {
    const [config] = await db.select().from(swarmConfig);
    if (!config) {
      // Initialize default config if none exists
      const [newConfig] = await db.insert(swarmConfig).values({
        agentCount: 20,
        speed: 2,
        cohesion: 50,
        separation: 30,
        sensorRange: 100,
        boundaryForce: 50,
        obstacleAvoidance: 70,
      }).returning();
      return newConfig;
    }
    return config;
  }

  async updateConfig(config: InsertSwarmConfig): Promise<SwarmConfig> {
    const [existingConfig] = await db.select().from(swarmConfig);
    if (existingConfig) {
      const [updatedConfig] = await db
        .update(swarmConfig)
        .set(config)
        .where(eq(swarmConfig.id, existingConfig.id))
        .returning();
      return updatedConfig;
    } else {
      const [newConfig] = await db
        .insert(swarmConfig)
        .values(config)
        .returning();
      return newConfig;
    }
  }

  async getEnvironmentFeatures(): Promise<EnvironmentFeature[]> {
    return await db.select().from(environmentFeatures);
  }

  async addEnvironmentFeature(feature: InsertEnvironmentFeature): Promise<EnvironmentFeature> {
    const [newFeature] = await db
      .insert(environmentFeatures)
      .values(feature)
      .returning();
    return newFeature;
  }

  async updateAgentSensors(agentId: number, sensors: Agent['sensors']): Promise<Agent> {
    const [updatedAgent] = await db
      .update(agents)
      .set({ sensors })
      .where(eq(agents.id, agentId))
      .returning();
    return updatedAgent;
  }

  async initializeAgents(): Promise<void> {
    const existingAgents = await this.getAgents();
    if (existingAgents.length === 0) {
      const initialAgents: InsertAgent[] = Array.from({ length: 20 }, (_, i) => ({
        x: Math.floor(Math.random() * 800),
        y: Math.floor(Math.random() * 600),
        status: "active",
        role: i === 0 ? "leader" : "follower",
        behavior: "default",
        resources: { energy: 0, material: 0, data: 0 },
        sensors: {
          nearbyObstacles: [],
          nearbyResources: [],
          localDensity: 0,
          boundaryDistance: { top: 0, right: 0, bottom: 0, left: 0 }
        },
        memory: { interactions: [], resourceLocations: [] }
      }));

      await db.insert(agents).values(initialAgents);
    }
  }

  async initializeResources(): Promise<void> {
    const existingFeatures = await this.getEnvironmentFeatures();
    const resources = existingFeatures.filter(f => f.type === "resource");

    if (resources.length === 0) {
      const resourceTypes = ["energy", "material", "data"];
      const initialResources: InsertEnvironmentFeature[] = [];

      // Create clusters of resources
      for (let i = 0; i < 3; i++) {
        const centerX = 100 + Math.random() * 600;
        const centerY = 100 + Math.random() * 400;

        // Create 3-5 resources of each type in a cluster
        for (let j = 0; j < 3 + Math.floor(Math.random() * 3); j++) {
          const resourceType = resourceTypes[i];
          initialResources.push({
            type: "resource",
            x: Math.floor(centerX + (Math.random() - 0.5) * 100),
            y: Math.floor(centerY + (Math.random() - 0.5) * 100),
            radius: 10,
            effect: "collectible",
            strength: 100,
            resourceType,
            value: 10 + Math.floor(Math.random() * 41), // Value between 10-50
            collected: false,
          });
        }
      }

      await db.insert(environmentFeatures).values(initialResources);
    }
  }
}

export const storage = new DatabaseStorage();

// Initialize when storage is created
Promise.all([
  storage.initializeAgents(),
  storage.initializeResources()
]).catch(console.error);