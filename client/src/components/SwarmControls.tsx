import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { insertConfigSchema, type SwarmConfig, type InsertSwarmConfig } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function SwarmControls() {
  const queryClient = useQueryClient();
  const { data: config } = useQuery<SwarmConfig>({ 
    queryKey: ['/api/config'] 
  });

  const form = useForm<InsertSwarmConfig>({
    resolver: zodResolver(insertConfigSchema),
    defaultValues: config || {
      agentCount: 50,
      speed: 2,
      cohesion: 50,
      separation: 30,
      aiEnabled: false,
      decisionInterval: 1000
    }
  });

  const mutation = useMutation({
    mutationFn: async (values: InsertSwarmConfig) => {
      await apiRequest('POST', '/api/config', values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/config'] });
    }
  });

  const onSliderChange = (field: keyof InsertSwarmConfig, value: number[]) => {
    form.setValue(field, value[0]);
    mutation.mutate(form.getValues());
  };

  const onSwitchChange = (field: keyof InsertSwarmConfig, value: boolean) => {
    form.setValue(field, value);
    mutation.mutate(form.getValues());
  };

  return (
    <Form {...form}>
      <div className="space-y-6">
        <FormField
          name="agentCount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Agent Count</FormLabel>
              <FormControl>
                <Slider
                  min={10}
                  max={100}
                  step={1}
                  value={[field.value]}
                  onValueChange={(value) => onSliderChange("agentCount", value)}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          name="speed"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Speed</FormLabel>
              <FormControl>
                <Slider
                  min={1}
                  max={5}
                  step={0.1}
                  value={[field.value]}
                  onValueChange={(value) => onSliderChange("speed", value)}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          name="cohesion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cohesion</FormLabel>
              <FormControl>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[field.value]}
                  onValueChange={(value) => onSliderChange("cohesion", value)}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          name="separation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Separation</FormLabel>
              <FormControl>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[field.value]}
                  onValueChange={(value) => onSliderChange("separation", value)}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          name="aiEnabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>AI Control</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Enable AI-driven agent behavior
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={(value) => onSwitchChange("aiEnabled", value)}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {form.watch("aiEnabled") && (
          <FormField
            name="decisionInterval"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Decision Interval (ms)</FormLabel>
                <FormControl>
                  <Slider
                    min={500}
                    max={5000}
                    step={100}
                    value={[field.value]}
                    onValueChange={(value) => onSliderChange("decisionInterval", value)}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}
      </div>
    </Form>
  );
}