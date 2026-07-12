import React from 'react';
import { NavControls } from '@/components/NavControls';
import { useListDocuments, useListBanks } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { analytics } from '@/lib/analytics';

export default function Documents() {
  const { data: documents, isLoading: docsLoading } = useListDocuments();
  const { data: banks, isLoading: banksLoading } = useListBanks();

  const isLoading = docsLoading || banksLoading;

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  // Sort newest first based on createdAt
  const sortedDocs = [...(documents || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="p-8 pb-24 max-w-5xl mx-auto w-full space-y-8">
      <header className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-foreground to-foreground/60 mb-2 flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            Global Documents
          </h1>
          <p className="text-foreground/50 text-lg">Central repository of all uploaded documents</p>
        </div>
        <NavControls />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedDocs.map(doc => {
          const bank = banks?.find(b => b.id === doc.bankId);
          const docUrl = doc.fileUrl || doc.oneDriveWebUrl || doc.link;
          return (
            <Card key={doc.id} className="bg-foreground/5 border-foreground/10 hover:border-foreground/20 transition-all flex flex-col h-full">
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                  <Badge variant="outline" className="bg-foreground/5 border-foreground/10 text-foreground/70">
                    {bank?.nameEn || 'Unknown Bank'}
                  </Badge>
                  {doc.docType && (
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                      {doc.docType}
                    </Badge>
                  )}
                </div>
                
                <h3 className="text-xl font-bold text-foreground mb-2 line-clamp-2">{doc.title}</h3>
                
                <div className="text-sm text-foreground/50 space-y-1 mb-6">
                  {doc.uploadedBy && <p>Uploaded by {doc.uploadedBy}</p>}
                  <p>{formatDateTime(doc.createdAt)}</p>
                </div>
                
                <div className="mt-auto pt-4 border-t border-foreground/10">
                  {docUrl ? (
                    <Button asChild variant="outline" className="w-full gap-2 border-foreground/10 bg-foreground/5 hover:bg-foreground/10 hover:text-foreground">
                      <a
                        href={docUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => analytics.documentDownloaded({
                          doc_id: doc.id,
                          bank_id: doc.bankId ?? undefined,
                          file_name: doc.title,
                          doc_type: doc.docType ?? undefined,
                          source: 'global_documents',
                        })}
                      >
                        Open Document <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  ) : (
                    <Button disabled variant="outline" className="w-full gap-2 border-foreground/5 bg-transparent text-foreground/30">
                      No link available
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {sortedDocs.length === 0 && (
          <div className="col-span-full py-12 text-center text-foreground/30 border border-dashed border-foreground/10 rounded-xl">
            No documents found
          </div>
        )}
      </div>
    </div>
  );
}
