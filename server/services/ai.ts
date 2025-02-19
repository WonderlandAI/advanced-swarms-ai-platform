import OpenAI from "openai";
import { type EnvironmentFeature } from "@shared/schema";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface AgentContext {
  id: number;
  role: string;
  position: { x: number; y: number };
  neighbors: Array<{ id: number; role: string; x: number; y: number }>;
  memory: {
    interactions: Array<{
      agentId: number;
      type: string;
      timestamp: string;
    }>;
  };
  sensors: {
    nearbyObstacles: Array<{
      id: number;
      type: string;
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
  };
}

interface EnvironmentalContext {
  boundaries: { width: number; height: number };
  obstacles: Array<{ x: number; y: number; radius: number }>;
  goals: Array<{ x: number; y: number; priority: number }>;
}

export class AIService {
  private static instance: AIService;
  private decisionCache: Map<number, {
    decision: any;
    timestamp: number;
  }> = new Map();

  private environmentalContext: EnvironmentalContext = {
    boundaries: { width: 800, height: 600 },
    obstacles: [],
    goals: []
  };

  private constructor() {}

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  async getAgentDecision(context: AgentContext) {
    const now = Date.now();
    const cachedDecision = this.decisionCache.get(context.id);

    // Reuse cached decision if it's less than 5 seconds old
    if (cachedDecision && (now - cachedDecision.timestamp) < 5000) {
      return {
        ...cachedDecision.decision,
        reused: true
      };
    }

    try {
      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are an AI swarm agent making decisions based on local information and collective behavior rules. 
            Your responses should be concise and focused on immediate actions.
            Consider the following behaviors:
            - Cohesion: Stay close to neighboring agents
            - Separation: Avoid collisions with others
            - Alignment: Match velocity with nearby agents
            - Leadership: Leaders guide followers, followers seek leaders
            - Exploration: Search for optimal positions
            - Memory: Learn from past interactions
            - Adaptation: Adjust behavior based on local density
            - Boundary awareness: Respect environmental boundaries
            - Obstacle avoidance: Navigate around obstacles safely`
          },
          {
            role: "user",
            content: this.buildPrompt(context)
          }
        ],
        model: "gpt-3.5-turbo",
        max_tokens: 150,
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const decision = this.parseDecision(completion.choices[0].message.content);

      // Cache the decision
      this.decisionCache.set(context.id, {
        decision,
        timestamp: now
      });

      return {
        ...decision,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error("Error getting AI decision:", error);

      if (error.code === 'insufficient_quota' || error.status === 429) {
        const basicBehavior = this.getBasicSwarmBehavior(context);
        return {
          ...basicBehavior,
          reasoning: "Using basic swarm behavior due to API limitations",
          timestamp: new Date().toISOString()
        };
      }

      return {
        action: "continue",
        reasoning: "Failed to get AI decision, continuing with default behavior",
        timestamp: new Date().toISOString()
      };
    }
  }

  private getBasicSwarmBehavior(context: AgentContext) {
    // Check if near boundaries
    const nearBoundary = Object.values(context.sensors.boundaryDistance).some(d => d < 50);
    if (nearBoundary) {
      return {
        action: "avoid",
        priority: 9,
        reasoning: "Moving away from boundary",
        target: {
          x: 400 + (Math.random() * 200 - 100),
          y: 300 + (Math.random() * 200 - 100)
        }
      };
    }

    // Check if near obstacles
    const nearestObstacle = context.sensors.nearbyObstacles[0];
    if (nearestObstacle && nearestObstacle.distance < 50) {
      return {
        action: "avoid",
        priority: 8,
        reasoning: "Avoiding obstacle",
        target: {
          x: context.position.x + Math.cos(nearestObstacle.direction + Math.PI) * 50,
          y: context.position.y + Math.sin(nearestObstacle.direction + Math.PI) * 50
        }
      };
    }

    const nearestLeader = context.neighbors.find(n => n.role === "leader");

    if (context.role === "leader") {
      return {
        action: "explore",
        priority: 7,
        target: {
          x: Math.random() * this.environmentalContext.boundaries.width,
          y: Math.random() * this.environmentalContext.boundaries.height
        }
      };
    }

    if (nearestLeader) {
      return {
        action: "follow",
        priority: 8,
        target: {
          x: nearestLeader.x,
          y: nearestLeader.y
        }
      };
    }

    return {
      action: "align",
      priority: 5
    };
  }

  private buildPrompt(context: AgentContext): string {
    const nearestLeader = context.neighbors.find(n => n.role === "leader");
    const nearbyFollowers = context.neighbors.filter(n => n.role === "follower");
    const recentInteractions = context.memory.interactions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);

    const nearestObstacle = context.sensors.nearbyObstacles[0];
    const criticalBoundary = Object.entries(context.sensors.boundaryDistance)
      .find(([_, distance]) => distance < 50);

    return `
As a swarm agent (ID: ${context.id}, Role: ${context.role}), analyze your situation:

Current State:
- Position: (${context.position.x}, ${context.position.y})
- Nearby agents: ${context.neighbors.length}
${nearestLeader ? `- Nearest leader at: (${nearestLeader.x}, ${nearestLeader.y})` : ''}
- Nearby followers: ${nearbyFollowers.length}
- Local density: ${context.sensors.localDensity.toFixed(2)}

Environmental Awareness:
${nearestObstacle ? `- Nearest obstacle: ${nearestObstacle.type} at ${nearestObstacle.distance.toFixed(0)} units` : '- No nearby obstacles'}
${criticalBoundary ? `- Approaching ${criticalBoundary[0]} boundary (${criticalBoundary[1]} units)` : '- Safe distance from boundaries'}

Recent Memory:
${recentInteractions.map(i => `- ${i.type} interaction with Agent ${i.agentId} at ${i.timestamp}`).join('\n')}

Choose your next action:
1. "move_towards": Move to a specific target with purpose
2. "hold": Maintain current position
3. "explore": Seek new areas
4. "avoid": Move away from obstacles or boundaries
5. "align": Match movement with neighbors
6. "lead": Guide other agents (if leader)
7. "follow": Track and mirror leader movement

Respond with a JSON object containing:
{
  "action": "move_towards|hold|explore|avoid|align|lead|follow",
  "reasoning": "brief explanation of decision",
  "target": {"x": number, "y": number}  // optional, used for move_towards
  "priority": number  // 1-10, urgency of the action
}

Consider:
- Leaders should coordinate and guide followers
- Maintain optimal distance from neighbors
- Adapt to local density
- Learn from recent interactions
- Balance exploration and cohesion
- Avoid obstacles and boundaries
- Adjust behavior based on sensor data
`;
  }

  private calculateLocalDensity(context: AgentContext): string {
    if (context.sensors.localDensity < 0.2) return "sparse";
    if (context.sensors.localDensity < 0.5) return "low";
    if (context.sensors.localDensity < 0.8) return "moderate";
    return "high";
  }

  private parseDecision(decisionStr: string | null): {
    action: string;
    reasoning: string;
    target?: { x: number; y: number };
    priority?: number;
  } {
    if (!decisionStr) {
      return {
        action: "continue",
        reasoning: "No decision received"
      };
    }

    try {
      const parsed = JSON.parse(decisionStr);
      return {
        action: parsed.action || "continue",
        reasoning: parsed.reasoning || "No reasoning provided",
        target: parsed.target || undefined,
        priority: parsed.priority || 5
      };
    } catch (error) {
      return {
        action: "continue",
        reasoning: "Failed to parse decision"
      };
    }
  }
}

export const aiService = AIService.getInstance();