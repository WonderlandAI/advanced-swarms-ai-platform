import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles } from "lucide-react";
import type { Agent, SwarmConfig } from '@shared/schema';

interface PerformanceMetrics {
  resourcesPerMinute: number;
  efficiency: number;
  coverage: number;
  suggestions: string[];
}

export default function PerformanceAnalytics() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    resourcesPerMinute: 0,
    efficiency: 0,
    coverage: 0,
    suggestions: []
  });

  const { data: agents } = useQuery<Agent[]>({ 
    queryKey: ['/api/agents'] 
  });

  const { data: config } = useQuery<SwarmConfig>({
    queryKey: ['/api/config']
  });

  useEffect(() => {
    if (!agents || !config) return;

    // Calculate resources per minute
    const totalResources = agents.reduce((sum, agent) => {
      if (!agent.resources) return sum;
      return sum + Object.values(agent.resources).reduce((a, b) => a + b, 0);
    }, 0);

    // Calculate area coverage (based on agent positions)
    const positions = agents.map(a => ({ x: a.x, y: a.y }));
    const coverage = calculateCoverage(positions, 800, 600);

    // Calculate overall efficiency
    const efficiency = calculateEfficiency(agents, config);

    // Generate optimization suggestions
    const suggestions = generateSuggestions(config, efficiency, coverage);

    setMetrics({
      resourcesPerMinute: totalResources / (performance.now() / 60000),
      efficiency,
      coverage,
      suggestions
    });
  }, [agents, config]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Performance Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span>Resources per Minute</span>
                <span>{metrics.resourcesPerMinute.toFixed(1)}</span>
              </div>
              <Progress value={Math.min(metrics.resourcesPerMinute * 10, 100)} />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span>Swarm Efficiency</span>
                <span>{(metrics.efficiency * 100).toFixed(1)}%</span>
              </div>
              <Progress value={metrics.efficiency * 100} />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span>Area Coverage</span>
                <span>{(metrics.coverage * 100).toFixed(1)}%</span>
              </div>
              <Progress value={metrics.coverage * 100} />
            </div>
          </div>
        </CardContent>
      </Card>

      {metrics.suggestions.length > 0 && (
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertTitle>Optimization Suggestions</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-2">
              {metrics.suggestions.map((suggestion, i) => (
                <li key={i}>{suggestion}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Utility functions remain unchanged as they're internal
function calculateCoverage(
  positions: Array<{x: number, y: number}>,
  width: number,
  height: number
): number {
  const gridSize = 20;
  const grid = new Set<string>();

  positions.forEach(pos => {
    const gridX = Math.floor(pos.x / gridSize);
    const gridY = Math.floor(pos.y / gridSize);
    grid.add(`${gridX},${gridY}`);
  });

  const totalCells = (width / gridSize) * (height / gridSize);
  return grid.size / totalCells;
}

function calculateEfficiency(agents: Agent[], config: SwarmConfig): number {
  if (!agents.length) return 0;

  const totalResources = agents.reduce((sum, agent) => {
    if (!agent.resources) return sum;
    return sum + Object.values(agent.resources).reduce((a, b) => a + b, 0);
  }, 0);

  let totalDistance = 0;
  let pairs = 0;
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const dx = agents[i].x - agents[j].x;
      const dy = agents[i].y - agents[j].y;
      totalDistance += Math.sqrt(dx * dx + dy * dy);
      pairs++;
    }
  }
  const avgDistance = totalDistance / (pairs || 1);
  const distanceScore = Math.max(0, 1 - (avgDistance / 800));

  const aiScore = config.aiEnabled ? 
    agents.filter(a => a.lastDecision?.action === 'collect').length / agents.length : 
    0.5;

  return (
    (totalResources * 0.4) + 
    (distanceScore * 0.3) + 
    (aiScore * 0.3)
  );
}

function generateSuggestions(
  config: SwarmConfig,
  efficiency: number,
  coverage: number
): string[] {
  const suggestions: string[] = [];

  if (efficiency < 0.3) {
    if (config.cohesion > 70) {
      suggestions.push("Reduce cohesion for better resource collection");
    }
    if (config.separation < 30) {
      suggestions.push("Increase separation to avoid overcrowding");
    }
    if (!config.aiEnabled) {
      suggestions.push("Enable AI control for smarter behavior");
    }
  }

  if (coverage < 0.4) {
    if (config.speed < 2) {
      suggestions.push("Increase speed for better area coverage");
    }
    if (config.explorationWeight < 50) {
      suggestions.push("Increase exploration weight for better coverage");
    }
  }

  if (config.aiEnabled && efficiency < 0.5) {
    if (config.decisionInterval > 2000) {
      suggestions.push("Decrease decision interval for faster reactions");
    }
    if (config.communicationRange < 80) {
      suggestions.push("Increase communication range for better coordination");
    }
  }

  return suggestions;
}