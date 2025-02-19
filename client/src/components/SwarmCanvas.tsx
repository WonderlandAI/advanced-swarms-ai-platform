import { useEffect, useRef, MouseEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type Agent, type EnvironmentFeature } from '@shared/schema';
import { useSwarm } from '@/lib/swarm';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function SwarmCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { data: agents } = useQuery<Agent[]>({ 
    queryKey: ['/api/agents']
  });
  const { data: features } = useQuery<EnvironmentFeature[]>({
    queryKey: ['/api/environment']
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { updatePositions } = useSwarm();

  const addResource = useMutation({
    mutationFn: async (resource: { x: number; y: number; type: string }) => {
      await apiRequest('POST', '/api/environment', {
        type: 'resource',
        x: resource.x,
        y: resource.y,
        radius: 10,
        effect: 'collectible',
        strength: 100,
        resourceType: resource.type,
        value: 10 + Math.floor(Math.random() * 41),
        collected: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/environment'] });
      toast({
        title: "Resource Added",
        description: "New resource has been placed on the map",
      });
    },
  });

  const handleCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    // Cycle through resource types on clicks
    const resourceTypes = ['energy', 'material', 'data'];
    const existingResources = features?.filter(f => f.type === 'resource') || [];
    const currentTypeIndex = existingResources.length % resourceTypes.length;

    addResource.mutate({
      x,
      y,
      type: resourceTypes[currentTypeIndex],
    });
  };

  useEffect(() => {
    if (!canvasRef.current || !agents || !features) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      if (!canvasRef.current) return;

      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      // Draw resources first (so they appear behind agents)
      features.forEach(feature => {
        if (feature.type === 'resource' && !feature.collected) {
          ctx.beginPath();
          ctx.arc(feature.x, feature.y, feature.radius, 0, Math.PI * 2);

          // Color based on resource type
          switch (feature.resourceType) {
            case 'energy':
              ctx.fillStyle = '#FFD700'; // Gold for energy
              break;
            case 'material':
              ctx.fillStyle = '#4CAF50'; // Green for material
              break;
            case 'data':
              ctx.fillStyle = '#2196F3'; // Blue for data
              break;
            default:
              ctx.fillStyle = '#9E9E9E'; // Gray for unknown
          }

          ctx.fill();

          // Draw value indicator
          if (feature.value) {
            ctx.fillStyle = '#FFF';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(feature.value.toString(), feature.x, feature.y + 4);
          }

          ctx.closePath();
        }
      });

      // Draw agents
      agents.forEach(agent => {
        ctx.beginPath();

        // Draw agent circle
        ctx.arc(agent.x, agent.y, 5, 0, Math.PI * 2);

        // Color based on role and AI behavior
        if (agent.role === 'leader') {
          ctx.fillStyle = '#60A5FA'; // Blue for leaders
        } else if (agent.lastDecision?.action === 'collect') {
          ctx.fillStyle = '#F59E0B'; // Yellow for resource collection
        } else if (agent.lastDecision?.action === 'move_towards') {
          ctx.fillStyle = '#34D399'; // Green for AI-controlled movement
        } else {
          ctx.fillStyle = '#9CA3AF'; // Gray for basic behavior
        }

        ctx.fill();

        // Draw direction indicator if moving towards target
        if (agent.lastDecision?.action === 'move_towards' && agent.lastDecision.target) {
          ctx.beginPath();
          ctx.moveTo(agent.x, agent.y);
          ctx.lineTo(
            agent.x + (agent.lastDecision.target.x - agent.x) * 0.2,
            agent.y + (agent.lastDecision.target.y - agent.y) * 0.2
          );
          ctx.strokeStyle = '#34D399';
          ctx.stroke();
        }

        // Draw resource indicator if agent is carrying resources
        if (agent.resources && (agent.resources.energy > 0 || agent.resources.material > 0 || agent.resources.data > 0)) {
          ctx.beginPath();
          ctx.arc(agent.x, agent.y - 8, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#F59E0B';
          ctx.fill();
        }

        ctx.closePath();
      });

      updatePositions();
      requestAnimationFrame(animate);
    };

    animate();
  }, [agents, features, updatePositions]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full bg-black rounded-lg cursor-crosshair"
      width={800}
      height={600}
      onClick={handleCanvasClick}
    />
  );
}