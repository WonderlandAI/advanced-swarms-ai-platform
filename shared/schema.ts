import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const environmentFeatures = pgTable("environment_features", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "obstacle", "zone", "boundary", "resource"
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  radius: integer("radius").notNull(),
  effect: text("effect").notNull(), // "repel", "attract", "slow", "speed", "collectible"
  strength: integer("strength").notNull().default(50),
  resourceType: text("resource_type"), // "energy", "material", "data"
  value: integer("value"), // Resource value/importance
  collected: boolean("collected").default(false),
  collectorId: integer("collector_id"), // ID of agent that collected this resource
});

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  status: text("status").notNull(),
  role: text("role").notNull(),
  behavior: text("behavior").notNull().default("default"),
  resources: jsonb("resources").$type<{
    energy: number;
    material: number;
    data: number;
  }>().default({ energy: 0, material: 0, data: 0 }),
  lastDecision: jsonb("last_decision").$type<{
    action: string;
    reasoning: string;
    timestamp: string;
    target?: {
      x: number;
      y: number;
    };
  }>(),
  sensors: jsonb("sensors").$type<{
    nearbyObstacles: Array<{
      id: number;
      type: string;
      distance: number;
      direction: number;
    }>;
    nearbyResources: Array<{
      id: number;
      type: string;
      value: number;
      distance: number;
      direction: number;
    }>;
    localDensity: number;
    boundaryDistance: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  }>().default({
    nearbyObstacles: [],
    nearbyResources: [],
    localDensity: 0,
    boundaryDistance: { top: 0, right: 0, bottom: 0, left: 0 }
  }),
  memory: jsonb("memory").$type<{
    interactions: Array<{
      agentId: number;
      type: string;
      timestamp: string;
    }>;
    resourceLocations: Array<{
      x: number;
      y: number;
      type: string;
      lastSeen: string;
    }>;
  }>().default({ interactions: [], resourceLocations: [] }),
});

export const swarmConfig = pgTable("swarm_config", {
  id: serial("id").primaryKey(),
  agentCount: integer("agent_count").notNull(),
  speed: integer("speed").notNull(),
  cohesion: integer("cohesion").notNull(),
  separation: integer("separation").notNull(),
  aiEnabled: boolean("ai_enabled").notNull().default(false),
  decisionInterval: integer("decision_interval").notNull().default(1000),
  // Spatial awareness parameters
  sensorRange: integer("sensor_range").notNull().default(100),
  boundaryForce: integer("boundary_force").notNull().default(50),
  obstacleAvoidance: integer("obstacle_avoidance").notNull().default(70),
  // New AI configuration parameters
  explorationWeight: integer("exploration_weight").notNull().default(50),
  leaderInfluence: integer("leader_influence").notNull().default(70),
  memoryRetention: integer("memory_retention").notNull().default(5),
  adaptiveSpeed: boolean("adaptive_speed").notNull().default(false),
  communicationRange: integer("communication_range").notNull().default(100),
  goalOrientation: integer("goal_orientation").notNull().default(50),
  // Resource collection parameters
  resourcePriority: integer("resource_priority").notNull().default(60),
  sharingEnabled: boolean("sharing_enabled").notNull().default(true),
});

export const insertAgentSchema = createInsertSchema(agents);
export const insertConfigSchema = createInsertSchema(swarmConfig);
export const insertEnvironmentFeatureSchema = createInsertSchema(environmentFeatures);

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type SwarmConfig = typeof swarmConfig.$inferSelect;
export type InsertSwarmConfig = z.infer<typeof insertConfigSchema>;
export type EnvironmentFeature = typeof environmentFeatures.$inferSelect;
export type InsertEnvironmentFeature = z.infer<typeof insertEnvironmentFeatureSchema>;