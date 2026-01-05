
"use client";

import { useState, useEffect } from "react";
import type { RecordRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/use-translation";

type PairScore = {
  aId: string;
  bId: string;
  score: number;
  breakdown: {
    firstNameScore: number;
    familyNameScore: number;
    advancedNameScore: number;
    tokenReorderScore: number;
    husbandScore: number;
    childrenScore: number;
    idScore: number;
    phoneScore: number;
    locationScore: number;
  };
  reasons: string[];
};

type EnrichedCluster = {
  records: RecordRow[];
  pairScores?: PairScore[];
  [key: string]: any;
};

interface PairwiseModalProps {
  cluster: EnrichedCluster;
  isOpen: boolean;
  onClose: () => void;
}

export function PairwiseModal({ cluster, isOpen, onClose }: PairwiseModalProps) {
  const { t } = useTranslation();
  const [pairs, setPairs] = useState<PairScore[]>([]);

  useEffect(() => {
    if (isOpen && cluster?.pairScores) {
      // Sort pairs by score, descending
      const sortedPairs = [...cluster.pairScores].sort((a,b) => b.score - a.score);
      setPairs(sortedPairs);
    } else if (isOpen) {
      // Handle case where pairScores might be missing
      setPairs([]);
    }
  }, [isOpen, cluster]);

  const getRecordById = (id: string): RecordRow | undefined => {
    return cluster.records.find(r => r._internalId === id);
  }
  
  const getChildrenText = (record: RecordRow | undefined) => {
    if (!record) return '';
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
          {pairs.length === 0 ? (
             <div className="text-center text-muted-foreground py-10">
                <p>No detailed pairwise scores were found for this cluster.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pairs.map((p: any, i) => {
                const recordA = getRecordById(p.aId);
                const recordB = getRecordById(p.bId);

                if (!recordA || !recordB) return null;

                return (
                    <Card key={i}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between text-lg">
                          <span>{recordA.womanName} ↔ {recordB.womanName}</span>
                          <Badge variant={p.score > 0.85 ? "destructive" : p.score > 0.7 ? "default" : "secondary"}>
                            {t('review.pairwiseModal.score')}: {p.score.toFixed(3)}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                  <h4 className="font-semibold mb-2">{t('review.pairwiseModal.recordA')}</h4>
                                  <p className="text-sm"><strong>{t('upload.mappingFields.husbandName')}:</strong> {recordA.husbandName}</p>
                                  <p className="text-sm"><strong>{t('upload.mappingFields.nationalId')}:</strong> {recordA.nationalId}</p>
                                  <p className="text-sm"><strong>{t('upload.mappingFields.phone')}:</strong> {recordA.phone}</p>
                                  <p className="text-sm"><strong>{t('upload.mappingFields.village')}:</strong> {recordA.village}</p>
                                  <p className="text-sm"><strong>{t('upload.mappingFields.children')}:</strong> {getChildrenText(recordA)}</p>
                              </div>
                              <div>
                                  <h4 className="font-semibold mb-2">{t('review.pairwiseModal.recordB')}</h4>
                                  <p className="text-sm"><strong>{t('upload.mappingFields.husbandName')}:</strong> {recordB.husbandName}</p>
                                  <p className="text-sm"><strong>{t('upload.mappingFields.nationalId')}:</strong> {recordB.nationalId}</p>
                                  <p className="text-sm"><strong>{t('upload.mappingFields.phone')}:</strong> {recordB.phone}</p>
                                  <p className="text-sm"><strong>{t('upload.mappingFields.village')}:</strong> {recordB.village}</p>
                                  <p className="text-sm"><strong>{t('upload.mappingFields.children')}:</strong> {getChildrenText(recordB)}</p>
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
                            <TableRow>
                                <TableCell className="font-medium">{t('review.pairwiseModal.firstNameScore')}</TableCell>
                                <TableCell className="text-right font-mono">{p.firstNameScore.toFixed(4)}</TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="font-medium">{t('review.pairwiseModal.familyNameScore')}</TableCell>
                                <TableCell className="text-right font-mono">{p.familyNameScore.toFixed(4)}</TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="font-medium">{t('review.pairwiseModal.advancedNameScore')}</TableCell>
                                <TableCell className="text-right font-mono">{p.advancedNameScore.toFixed(4)}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">{t('review.pairwiseModal.tokenReorderScore')}</TableCell>
                                <TableCell className="text-right font-mono">{p.tokenReorderScore.toFixed(4)}</TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="font-medium">{t('review.pairwiseModal.husbandScore')}</TableCell>
                                <TableCell className="text-right font-mono">{p.husbandScore.toFixed(4)}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">{t('review.pairwiseModal.childrenScore')}</TableCell>
                                <TableCell className="text-right font-mono">{p.childrenScore.toFixed(4)}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">{t('review.pairwiseModal.idScore')}</TableCell>
                                <TableCell className="text-right font-mono">{p.idScore.toFixed(4)}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">{t('review.pairwiseModal.phoneScore')}</TableCell>
                                <TableCell className="text-right font-mono">{p.phoneScore.toFixed(4)}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">{t('review.pairwiseModal.locationScore')}</TableCell>
                                <TableCell className="text-right font-mono">{p.locationScore.toFixed(4)}</TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="font-medium">{t('review.pairwiseModal.finalScore')}</TableCell>
                                <TableCell className="text-right font-mono">{p.score.toFixed(4)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                )
              })}
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
