import { Card } from "@/components/ui/card";
import SwarmCanvas from "@/components/SwarmCanvas";
import SwarmControls from "@/components/SwarmControls";
import AIConfigWizard from "@/components/AIConfigWizard";
import ResourceDashboard from "@/components/ResourceDashboard";
import PerformanceAnalytics from "@/components/PerformanceAnalytics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-3/4">
            <Card className="p-4 h-[600px]">
              <SwarmCanvas />
            </Card>
            <div className="mt-4">
              <ResourceDashboard />
            </div>
          </div>
          <div className="w-full md:w-1/4">
            <Tabs defaultValue="controls">
              <TabsList className="w-full">
                <TabsTrigger value="controls" className="flex-1">Controls</TabsTrigger>
                <TabsTrigger value="ai" className="flex-1">AI Config</TabsTrigger>
                <TabsTrigger value="analytics" className="flex-1">Analysis</TabsTrigger>
              </TabsList>
              <TabsContent value="controls">
                <Card className="p-4">
                  <SwarmControls />
                </Card>
              </TabsContent>
              <TabsContent value="ai">
                <AIConfigWizard />
              </TabsContent>
              <TabsContent value="analytics">
                <Card className="p-4">
                  <PerformanceAnalytics />
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}