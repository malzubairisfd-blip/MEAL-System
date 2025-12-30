"use client";

import { useState, useEffect } from "react";
import type { RecordRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Microscope } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/use-translation";

type Cluster = RecordRow[];
type PairwiseData = { a: RecordRow; b: RecordRow; score: number; breakdown: any };

interface PairwiseModalProps {
  cluster: Cluster;
  isOpen: boolean;
  onClose: () => void;
}

export function PairwiseModal({ cluster, isOpen, onClose }: PairwiseModalProps) {
  const { t } = useTranslation();
  const [pairs, setPairs] = useState<PairwiseData[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Reset state when a new cluster is opened
    if (isOpen) {
      setPairs([]);
    }
  }, [isOpen]);

  async function loadPairs() {
    setLoading(true);
    try {
      const res = await fetch("/api/pairwise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cluster }),
      });
      if (!res.ok) throw new Error("Failed to fetch pairwise data");
      const data = await res.json();
      setPairs(data.pairs || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not load pairwise similarity scores.",
        variant: "destructive",
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  }
  
  const getChildrenText = (record: RecordRow) => {
    if (Array.isArray(record.children)) {
      return record.children.join(', ');
    }
    return record.children || '';
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('review.pairwiseModal.title')}</DialogTitle>
          <DialogDescription>{t('review.pairwiseModal.description')}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-6 -mr-6">
          <Button onClick={loadPairs} disabled={loading || pairs.length > 0} className="mb-4">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Microscope className="mr-2 h-4 w-4" />}
            {pairs.length > 0 ? t('review.pairwiseModal.scoresLoaded') : t('review.pairwiseModal.loadButton')}
          </Button>

          {loading && pairs.length === 0 ? (
             <div className="text-center text-muted-foreground py-10">
                <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                <p className="mt-2">{t('review.pairwiseModal.calculating')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pairs.map((p, i) => (
                <Card key={i}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span>{p.a.womanName} ↔ {p.b.womanName}</span>
                      <Badge variant={p.score > 0.85 ? "destructive" : p.score > 0.7 ? "default" : "secondary"}>
                        {t('review.pairwiseModal.score')}: {p.score.toFixed(3)}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                              <h4 className="font-semibold mb-2">{t('review.pairwiseModal.recordA')}</h4>
                              <p className="text-sm"><strong>{t('upload.mappingFields.husbandName')}:</strong> {p.a.husbandName}</p>
                              <p className="text-sm"><strong>{t('upload.mappingFields.nationalId')}:</strong> {p.a.nationalId}</p>
                              <p className="text-sm"><strong>{t('upload.mappingFields.phone')}:</strong> {p.a.phone}</p>
                              <p className="text-sm"><strong>{t('upload.mappingFields.village')}:</strong> {p.a.village}</p>
                              <p className="text-sm"><strong>{t('upload.mappingFields.children')}:</strong> {getChildrenText(p.a)}</p>
                          </div>
                          <div>
                              <h4 className="font-semibold mb-2">{t('review.pairwiseModal.recordB')}</h4>
                              <p className="text-sm"><strong>{t('upload.mappingFields.husbandName')}:</strong> {p.b.husbandName}</p>
                              <p className="text-sm"><strong>{t('upload.mappingFields.nationalId')}:</strong> {p.b.nationalId}</p>
                              <p className="text-sm"><strong>{t('upload.mappingFields.phone')}:</strong> {p.b.phone}</p>
                              <p className="text-sm"><strong>{t('upload.mappingFields.village')}:</strong> {p.b.village}</p>
                              <p className="text-sm"><strong>{t('upload.mappingFields.children')}:</strong> {getChildrenText(p.b)}</p>
                          </div>
                      </div>
                    <h4 className="font-semibold mt-4 mb-2">{t('review.pairwiseModal.scoreBreakdown')}</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('review.pairwiseModal.component')}</TableHead>
                          <TableHead className="text-right">{t('review.pairwiseModal.score')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(p.breakdown).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell className="capitalize font-medium">{key.replace('Score', ' Score')}</TableCell>
                            <TableCell className="text-right font-mono">
                              {typeof value === 'number' ? value.toFixed(4) : String(value)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
         <DialogFooter>
            <Button variant="outline" onClick={onClose}>{t('review.pairwiseModal.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
