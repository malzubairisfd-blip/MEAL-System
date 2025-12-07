"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Microscope, ClipboardList, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  const features = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: "Upload & Cluster",
      description: "Start by uploading your beneficiary data in XLSX or CSV format. The system will automatically process the file and run the AI-powered clustering algorithm to find potential duplicates.",
      link: "/upload",
      buttonText: "Go to Upload",
    },
    {
      icon: <Microscope className="h-8 w-8 text-primary" />,
      title: "Review Clusters",
      description: "Inspect the generated clusters. Use the AI summaries and detailed pairwise comparisons to understand why certain records were grouped together and identify duplicate entries.",
      link: "/review",
      buttonText: "Go to Review",
    },
    {
      icon: <ClipboardList className="h-8 w-8 text-primary" />,
      title: "Audit & Export",
      description: "Run a comprehensive data integrity audit to find issues like invalid relationships or duplicate IDs. Once your review is complete, export the enriched data and findings to a formatted Excel report.",
      link: "/audit",
      buttonText: "Go to Audit",
    },
  ];

  return (
    <div className="space-y-8">
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-3xl">Welcome to Beneficiary Insights</CardTitle>
          <CardDescription className="text-lg">
            An intelligent tool to help you identify duplicates and anomalies in beneficiary data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="max-w-3xl">
            This application uses advanced fuzzy matching and AI to analyze your data, group similar records into clusters, and run integrity audits. Start by uploading your file, then review the AI-generated insights to ensure data quality and prevent fraud.
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <Card key={index} className="flex flex-col">
            <CardHeader className="flex-row items-start gap-4">
              {feature.icon}
              <div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription className="mt-1">{feature.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex-1" />
            <div className="p-6 pt-0">
               <Button onClick={() => router.push(feature.link)} className="w-full">
                {feature.buttonText}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
