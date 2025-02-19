import { useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Agent, SwarmConfig, EnvironmentFeature } from '@shared/schema';
import { apiRequest } from './queryClient';

// Helper functions for swarm behaviors
const calculateDistance = (a: { x: number, y: number }, b: { x: number, y: number }) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const normalizeVector = (x: number, y: number) => {
  const magnitude = Math.sqrt(x * x + y * y);
  return magnitude > 0 ? { x: x / magnitude, y: y / magnitude } : { x: 0, y: 0 };
};

const calculateBoundaryForce = (
  position: { x: number, y: number },
  boundaries: { width: number, height: number },
  boundaryForce: number
) => {
  const margin = 50;
  const forceX =
    position.x < margin ? (margin - position.x) :
    position.x > boundaries.width - margin ? (boundaries.width - margin - position.x) :
    0;
  const forceY =
    position.y < margin ? (margin - position.y) :
    position.y > boundaries.height - margin ? (boundaries.height - margin - position.y) :
    0;

  return {
    x: forceX * (boundaryForce / 100),
    y: forceY * (boundaryForce / 100)
  };
};

export function useSwarm() {
  const queryClient = useQueryClient();
  const { data: agents } = useQuery<Agent[]>({ queryKey: ['/api/agents'] });
  const { data: config } = useQuery<SwarmConfig>({ queryKey: ['/api/config'] });
  const { data: environmentFeatures } = useQuery<EnvironmentFeature[]>({
    queryKey: ['/api/environment']
  });
  const lastDecisionTime = useRef<number>(Date.now());

  const calculateObstacleAvoidance = useCallback((
    agent: Agent,
    obstacles: EnvironmentFeature[],
    obstacleAvoidance: number
  ) => {
    let totalForceX = 0;
    let totalForceY = 0;

    obstacles.forEach(obstacle => {
      const distance = calculateDistance(agent, obstacle);
      if (distance < obstacle.radius + 50) {
        const force = (obstacle.radius + 50 - distance) / (obstacle.radius + 50);
        const angle = Math.atan2(agent.y - obstacle.y, agent.x - obstacle.x);

        // Apply effect based on obstacle type
        let effectMultiplier = 1;
        switch (obstacle.effect) {
          case "repel":
            effectMultiplier = 1.5;
            break;
          case "attract":
            effectMultiplier = -0.5;
            break;
          case "slow":
            effectMultiplier = 0.3;
            break;
          case "speed":
            effectMultiplier = 2.0;
            break;
        }

        const effectiveForce = force * (obstacleAvoidance / 100) * effectMultiplier * (obstacle.strength / 100);
        totalForceX += Math.cos(angle) * effectiveForce;
        totalForceY += Math.sin(angle) * effectiveForce;
      }
    });

    return { x: totalForceX, y: totalForceY };
  }, []);

  const updateAgentSensors = useCallback((agent: Agent, neighbors: Agent[]) => {
    if (!config || !environmentFeatures) return agent;

    // Calculate local density with weighted zones
    const localDensity = neighbors.reduce((density, n) => {
      const distance = calculateDistance(agent, n);
      if (distance < config.sensorRange) {
        // Check if in special zone
        const zone = environmentFeatures.find(feature => 
          feature.type === "zone" && 
          calculateDistance(n, feature) < feature.radius
        );

        // Apply zone effects to density calculation
        const zoneMult = zone?.effect === "attract" ? 1.5 : 
                        zone?.effect === "repel" ? 0.5 : 1;

        return density + (1 - distance/config.sensorRange) * zoneMult;
      }
      return density;
    }, 0) / config.sensorRange;

    // Enhanced obstacle detection
    const nearbyObstacles = environmentFeatures
      .filter(feature => calculateDistance(agent, feature) < config.sensorRange)
      .map(feature => ({
        id: feature.id,
        type: feature.type,
        distance: calculateDistance(agent, feature),
        direction: Math.atan2(feature.y - agent.y, feature.x - agent.x)
      }));

    const boundaryDistance = {
      top: agent.y,
      right: 800 - agent.x,
      bottom: 600 - agent.y,
      left: agent.x
    };

    return {
      ...agent,
      sensors: {
        nearbyObstacles,
        localDensity,
        boundaryDistance
      }
    };
  }, [config, environmentFeatures]);

  const calculateFlockingBehavior = useCallback((agent: Agent, neighbors: Agent[]) => {
    if (!config || !environmentFeatures) return { x: 0, y: 0 };

    // Initialize vectors for each behavior
    let cohesionX = 0, cohesionY = 0;
    let separationX = 0, separationY = 0;
    let alignmentX = 0, alignmentY = 0;
    let leaderInfluenceX = 0, leaderInfluenceY = 0;

    // Calculate basic flocking behaviors
    const nearbyNeighbors = neighbors.filter(n => {
      const distance = calculateDistance(agent, n);
      return distance < config.communicationRange && distance > 0;
    });

    if (nearbyNeighbors.length > 0) {
      // Cohesion - move toward center of mass
      const centerOfMass = nearbyNeighbors.reduce((com, n) => ({
        x: com.x + n.x,
        y: com.y + n.y
      }), { x: 0, y: 0 });

      cohesionX = (centerOfMass.x / nearbyNeighbors.length - agent.x) * (config.cohesion / 100);
      cohesionY = (centerOfMass.y / nearbyNeighbors.length - agent.y) * (config.cohesion / 100);

      // Separation - avoid crowding
      nearbyNeighbors.forEach(n => {
        const distance = calculateDistance(agent, n);
        if (distance < config.separation) {
          const pushStrength = (config.separation - distance) / config.separation;
          separationX -= (n.x - agent.x) * pushStrength;
          separationY -= (n.y - agent.y) * pushStrength;
        }
      });

      // Alignment - match velocity with nearby agents
      const avgVelocity = nearbyNeighbors.reduce((vel, n) => {
        const dx = n.x - agent.x;
        const dy = n.y - agent.y;
        return {
          x: vel.x + dx,
          y: vel.y + dy
        };
      }, { x: 0, y: 0 });

      alignmentX = avgVelocity.x / nearbyNeighbors.length;
      alignmentY = avgVelocity.y / nearbyNeighbors.length;

      // Leader influence
      if (agent.role === 'follower') {
        const leaders = nearbyNeighbors.filter(n => n.role === 'leader');
        if (leaders.length > 0) {
          const closestLeader = leaders.reduce((closest, leader) => {
            const distToLeader = calculateDistance(agent, leader);
            const distToClosest = calculateDistance(agent, closest);
            return distToLeader < distToClosest ? leader : closest;
          });

          leaderInfluenceX = (closestLeader.x - agent.x) * (config.leaderInfluence / 100);
          leaderInfluenceY = (closestLeader.y - agent.y) * (config.leaderInfluence / 100);
        }
      }
    }

    // Calculate boundary forces
    const boundaryForce = calculateBoundaryForce(
      agent,
      { width: 800, height: 600 },
      config.boundaryForce
    );

    // Calculate obstacle avoidance
    const obstacleForce = calculateObstacleAvoidance(
      agent,
      environmentFeatures,
      config.obstacleAvoidance
    );

    // Combine all forces
    const totalX =
      cohesionX + separationX + alignmentX + leaderInfluenceX +
      boundaryForce.x + obstacleForce.x;
    const totalY =
      cohesionY + separationY + alignmentY + leaderInfluenceY +
      boundaryForce.y + obstacleForce.y;

    // Normalize the resulting vector
    return normalizeVector(totalX, totalY);
  }, [config, environmentFeatures, calculateObstacleAvoidance]);

  const updatePositions = useCallback(async () => {
    if (!agents || !config) return;

    const now = Date.now();
    const shouldUpdateAI = config.aiEnabled &&
      (now - lastDecisionTime.current >= 5000);

    if (shouldUpdateAI) {
      lastDecisionTime.current = now;

      // Only update 20% of agents with AI each cycle
      const agentsToUpdate = agents
        .filter(agent => 
          agent.role === 'leader' || 
          (Math.random() < 0.2 && agent.role === 'follower')
        );

      // Update agent states with sensor information
      const agentsWithSensors = agentsToUpdate.map(agent =>
        updateAgentSensors(agent, agents.filter(a => a.id !== agent.id))
      );

      // Get AI decisions only for selected agents
      const updatedAgents = await Promise.all(
        agents.map(async agent => {
          const shouldGetAIDecision = agentsWithSensors.find(a => a.id === agent.id);

          if (!shouldGetAIDecision) {
            return agent;
          }

          try {
            const response = await apiRequest('POST', `/api/agents/${agent.id}/decision`, {
              position: { x: agent.x, y: agent.y },
              role: agent.role,
              memory: agent.memory || { interactions: [] },
              sensors: agent.sensors,
              neighbors: agents.filter(a => a.id !== agent.id).map(a => ({
                id: a.id,
                role: a.role,
                x: a.x,
                y: a.y
              }))
            });

            const decision = await response.json();
            return {
              ...agent,
              lastDecision: {
                ...decision,
                reused: false
              }
            };
          } catch (error) {
            console.error('Error getting AI decision:', error);
            return agent;
          }
        })
      );

      // Apply movements based on both AI decisions and environmental forces
      const newAgents = updatedAgents.map(agent => {
        const flockingForce = calculateFlockingBehavior(agent, updatedAgents);
        let dx = flockingForce.x * config.speed;
        let dy = flockingForce.y * config.speed;

        // Apply AI decision if available
        if (agent.lastDecision?.action === 'move_towards' && agent.lastDecision.target) {
          const aiForce = normalizeVector(
            agent.lastDecision.target.x - agent.x,
            agent.lastDecision.target.y - agent.y
          );
          dx = (dx + aiForce.x * config.speed) / 2;
          dy = (dy + aiForce.y * config.speed) / 2;
        }

        return {
          ...agent,
          x: Math.max(0, Math.min(800, agent.x + dx)),
          y: Math.max(0, Math.min(600, agent.y + dy))
        };
      });

      queryClient.setQueryData(['/api/agents'], newAgents);
    } else {
      // Regular swarm movement with flocking behaviors and environmental forces
      const newAgents = agents.map(agent => {
        const flockingForce = calculateFlockingBehavior(agent, agents);
        const dx = flockingForce.x * config.speed;
        const dy = flockingForce.y * config.speed;

        return {
          ...agent,
          x: Math.max(0, Math.min(800, agent.x + dx)),
          y: Math.max(0, Math.min(600, agent.y + dy))
        };
      });

      queryClient.setQueryData(['/api/agents'], newAgents);
    }
  }, [agents, config, queryClient, calculateFlockingBehavior, updateAgentSensors]);

  return { updatePositions };
}