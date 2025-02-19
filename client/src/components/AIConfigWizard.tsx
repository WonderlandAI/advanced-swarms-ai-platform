import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertConfigSchema, type InsertSwarmConfig } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, Save, Check, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WizardStep {
  title: string;
  description: string;
  fields: (keyof InsertSwarmConfig)[];
}

const wizardSteps: WizardStep[] = [
  {
    title: "Basic AI Settings",
    description: "Configure the fundamental AI behavior parameters",
    fields: ["aiEnabled", "decisionInterval"],
  },
  {
    title: "Movement & Exploration",
    description: "Set how agents explore and move in the environment",
    fields: ["explorationWeight", "adaptiveSpeed", "communicationRange"],
  },
  {
    title: "Social Behavior",
    description: "Configure how agents interact with each other",
    fields: ["leaderInfluence", "goalOrientation"],
  },
  {
    title: "Memory & Learning",
    description: "Set up the agent's memory and learning capabilities",
    fields: ["memoryRetention"],
  },
];

const fieldDescriptions: Record<string, { description: string; tooltip: string }> = {
  aiEnabled: {
    description: "Enable or disable AI-driven agent behavior",
    tooltip: "When enabled, agents will make decisions using AI algorithms instead of basic swarm rules"
  },
  decisionInterval: {
    description: "Time between AI decisions (in milliseconds)",
    tooltip: "Lower values mean more frequent decisions but higher computational cost"
  },
  explorationWeight: {
    description: "Balance between exploring new areas and staying with the group",
    tooltip: "Higher values encourage agents to explore more, lower values keep them closer to the group"
  },
  leaderInfluence: {
    description: "How strongly followers are attracted to leader agents",
    tooltip: "Higher values make followers stick closer to leaders, lower values give them more independence"
  },
  memoryRetention: {
    description: "Number of past interactions agents remember",
    tooltip: "Higher values allow for more complex behavior patterns but increase computational load"
  },
  adaptiveSpeed: {
    description: "Allows agents to adjust their speed based on surroundings",
    tooltip: "When enabled, agents will slow down in crowded areas and speed up in open spaces"
  },
  communicationRange: {
    description: "Maximum distance for agent interaction",
    tooltip: "Determines how far agents can 'see' and interact with other agents"
  },
  goalOrientation: {
    description: "How strongly agents pursue their current objective",
    tooltip: "Higher values make agents more focused on their goals, lower values allow more flexibility"
  },
};

export default function AIConfigWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config } = useQuery<InsertSwarmConfig>({
    queryKey: ['/api/config'],
  });

  const form = useForm<InsertSwarmConfig>({
    resolver: zodResolver(insertConfigSchema),
    defaultValues: config || {
      aiEnabled: false,
      decisionInterval: 1000,
      explorationWeight: 50,
      leaderInfluence: 70,
      memoryRetention: 5,
      adaptiveSpeed: false,
      communicationRange: 100,
      goalOrientation: 50,
      agentCount: 50,
      speed: 2,
      cohesion: 50,
      separation: 30,
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: InsertSwarmConfig) => {
      await apiRequest('POST', '/api/config', values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/config'] });
      if (isComplete) {
        toast({
          title: "Configuration Complete",
          description: "AI agent settings have been saved successfully.",
        });
      }
    },
  });

  const onSliderChange = (field: keyof InsertSwarmConfig, value: number[]) => {
    form.setValue(field, value[0]);
    mutation.mutate(form.getValues());

    toast({
      title: "Setting Updated",
      description: `${field.replace(/([A-Z])/g, ' $1').trim()} has been updated to ${value[0]}`,
      duration: 2000,
    });
  };

  const onSwitchChange = (field: keyof InsertSwarmConfig, value: boolean) => {
    form.setValue(field, value);
    mutation.mutate(form.getValues());

    toast({
      title: "Setting Updated",
      description: `${field.replace(/([A-Z])/g, ' $1').trim()} has been ${value ? 'enabled' : 'disabled'}`,
      duration: 2000,
    });
  };

  const handleComplete = () => {
    setIsComplete(true);
    mutation.mutate(form.getValues());
  };

  const currentStepData = wizardSteps[currentStep];
  const isLastStep = currentStep === wizardSteps.length - 1;
  const progress = ((currentStep + 1) / wizardSteps.length) * 100;

  if (isComplete) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium">Configuration Complete!</h3>
            <p className="text-sm text-muted-foreground">
              Your AI agent settings have been saved. You can now return to the basic controls or make further adjustments.
            </p>
            <Button
              onClick={() => {
                setIsComplete(false);
                setCurrentStep(0);
              }}
              variant="outline"
            >
              Configure Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>AI Configuration Wizard - Step {currentStep + 1}/{wizardSteps.length}</CardTitle>
        <div className="w-full bg-secondary h-1 mt-2 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300 ease-in-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium">{currentStepData.title}</h3>
            <p className="text-sm text-muted-foreground">{currentStepData.description}</p>
          </div>

          <TooltipProvider>
            <Form {...form}>
              <div className="space-y-4">
                {currentStepData.fields.map((field) => {
                  if (typeof form.getValues(field) === "boolean") {
                    return (
                      <FormField
                        key={field}
                        name={field}
                        render={({ field: { value } }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <FormLabel>{field.replace(/([A-Z])/g, ' $1').trim()}</FormLabel>
                                <Tooltip>
                                  <TooltipTrigger className="cursor-help">
                                    <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">{fieldDescriptions[field].tooltip}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <FormDescription>
                                {fieldDescriptions[field].description}
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={value}
                                onCheckedChange={(checked) => onSwitchChange(field, checked)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    );
                  }

                  return (
                    <FormField
                      key={field}
                      name={field}
                      render={({ field: { value } }) => (
                        <FormItem>
                          <div className="flex items-center gap-2">
                            <FormLabel>{field.replace(/([A-Z])/g, ' $1').trim()}</FormLabel>
                            <Tooltip>
                              <TooltipTrigger className="cursor-help">
                                <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">{fieldDescriptions[field].tooltip}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <FormControl>
                            <Slider
                              min={field === "decisionInterval" ? 500 : 0}
                              max={field === "decisionInterval" ? 5000 : 100}
                              step={field === "decisionInterval" ? 100 : 1}
                              value={[value]}
                              onValueChange={(newValue) => onSliderChange(field, newValue)}
                              className="my-2"
                            />
                          </FormControl>
                          <FormDescription>
                            {fieldDescriptions[field].description}
                          </FormDescription>
                          <div className="text-sm text-muted-foreground mt-1">
                            Current value: {value}
                            {field === "decisionInterval" ? "ms" : ""}
                          </div>
                        </FormItem>
                      )}
                    />
                  );
                })}
              </div>
            </Form>
          </TooltipProvider>

          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            {isLastStep ? (
              <Button
                onClick={handleComplete}
                className="bg-green-600 hover:bg-green-700"
              >
                Complete
                <Check className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentStep(Math.min(wizardSteps.length - 1, currentStep + 1))}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}