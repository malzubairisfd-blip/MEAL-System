import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Microscope, ClipboardList, FileBarChart2 } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <FileBarChart2 className="h-8 w-8 text-primary" />
              <h1 className="text-xl font-bold tracking-tight text-foreground">Beneficiary Insights</h1>
            </div>
            <nav className="flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <Link href="/upload">Upload</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/review">Review</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/audit">Audit</Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <section className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter text-foreground mb-4 font-headline">
            AI-Powered Beneficiary Analysis
          </h2>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground">
            Upload your data, identify potential duplicates with advanced fuzzy matching, and run audits to ensure data integrity.
          </p>
        </section>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold font-headline">Upload Data</CardTitle>
              <Upload className="h-6 w-6 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Begin by uploading your beneficiary list in XLSX, CSV, or other supported formats.
              </p>
              <Button asChild className="w-full">
                <Link href="/upload">Start Upload</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold font-headline">Review Clusters</CardTitle>
              <Microscope className="h-6 w-6 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Manually inspect and analyze the generated clusters to verify potential duplicates.
              </p>
              <Button asChild className="w-full">
                <Link href="/review">Review Data</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold font-headline">Run Audit</CardTitle>
              <ClipboardList className="h-6 w-6 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Use our rule-based engine to find anomalies, from duplicate IDs to forbidden marriages.
              </p>
              <Button asChild className="w-full">
                <Link href="/audit">Start Audit</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <footer className="bg-card border-t">
          <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 text-center text-muted-foreground text-sm">
            © {new Date().getFullYear()} Beneficiary Insights. All rights reserved.
          </div>
      </footer>
    </div>
  );
}
