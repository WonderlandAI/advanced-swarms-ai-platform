import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, BarChart2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Agent, EnvironmentFeature } from '@shared/schema';

interface ResourceStats {
  collected: number;
  total: number;
  type: string;
}

export default function ResourceDashboard() {
  const { data: agents } = useQuery<Agent[]>({ 
    queryKey: ['/api/agents'] 
  });
  const { data: features } = useQuery<EnvironmentFeature[]>({
    queryKey: ['/api/environment']
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Calculate resource statistics
  const resourceStats: ResourceStats[] = ["energy", "material", "data"].map(type => {
    const total = features?.filter(f => f.resourceType === type).length ?? 0;
    const collected = features?.filter(f => 
      f.resourceType === type && f.collected
    ).length ?? 0;

    return { type, total, collected };
  });

  // Calculate total resources carried by agents
  const agentResources = agents?.reduce((acc, agent) => {
    if (agent.resources) {
      acc.energy += agent.resources.energy;
      acc.material += agent.resources.material;
      acc.data += agent.resources.data;
    }
    return acc;
  }, { energy: 0, material: 0, data: 0 });

  const addResource = useMutation({
    mutationFn: async (resourceType: string) => {
      // Add resource at random position
      const x = 100 + Math.random() * 600;
      const y = 100 + Math.random() * 400;

      await apiRequest('POST', '/api/environment', {
        type: 'resource',
        x: Math.round(x),
        y: Math.round(y),
        radius: 10,
        effect: 'collectible',
        strength: 100,
        resourceType,
        value: 10 + Math.floor(Math.random() * 41),
        collected: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/environment'] });
      toast({
        title: "Resource Added",
        description: "New resource has been placed on the map. You can also click directly on the map to add resources.",
      });
    },
  });

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      {resourceStats.map(stat => (
        <Card key={stat.type}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {stat.type.charAt(0).toUpperCase() + stat.type.slice(1)}
            </CardTitle>
            {stat.type === 'energy' ? (
              <BarChart2 className="h-4 w-4 text-yellow-500" />
            ) : stat.type === 'material' ? (
              <BarChart2 className="h-4 w-4 text-green-500" />
            ) : (
              <BarChart2 className="h-4 w-4 text-blue-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stat.collected}/{stat.total}
            </div>
            <p className="text-xs text-muted-foreground">
              Collected by agents: {agentResources?.[stat.type as keyof typeof agentResources] ?? 0}
            </p>
            <div className="mt-4">
              <Button 
                size="sm" 
                className="w-full"
                variant="outline"
                onClick={() => addResource.mutate(stat.type)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add New Resource
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}