import React from 'react';
import { NavControls } from '@/components/NavControls';
import { useListMeetings, useListBanks } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, getStatusColor } from '@/lib/utils';
import { Calendar } from 'lucide-react';

export default function Meetings() {
  const { data: meetings, isLoading: meetingsLoading } = useListMeetings();
  const { data: banks, isLoading: banksLoading } = useListBanks();

  const isLoading = meetingsLoading || banksLoading;

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const sortedMeetings = [...(meetings || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="p-8 pb-24 max-w-5xl mx-auto w-full space-y-8">
      <header className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-foreground to-foreground/60 mb-2 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-primary" />
            All Meetings
          </h1>
          <p className="text-foreground/50 text-lg">Global view of all planned and completed meetings</p>
        </div>
        <NavControls />
      </header>

      <div className="space-y-4">
        {sortedMeetings.map(m => {
          const bank = banks?.find(b => b.id === m.bankId);
          return (
            <Card key={m.id} className="bg-foreground/5 border-foreground/10 hover:border-foreground/20 transition-all">
              <CardContent className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
                <div className="md:w-48 shrink-0">
                  <div className="text-foreground/80 font-mono text-sm mb-1">{formatDate(m.date)}</div>
                  <Badge variant="outline" className="bg-foreground/5 border-foreground/10 text-foreground/70">
                    {bank?.nameEn || 'Unknown Bank'}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-foreground truncate">{m.topic}</h3>
                    {m.status && (
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-foreground/10 bg-foreground/5 text-xs font-semibold shrink-0 ${getStatusColor(m.status).text}`}>
                        {m.status}
                      </span>
                    )}
                  </div>
                  <p className="text-foreground/60 leading-relaxed whitespace-pre-wrap text-sm">
                    {m.summary || 'No summary available.'}
                  </p>
                  {m.attendees && (
                    <div className="mt-3 text-xs text-foreground/40">
                      <span className="font-semibold">Attendees:</span> {m.attendees}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {sortedMeetings.length === 0 && (
          <div className="py-12 text-center text-foreground/30 border border-dashed border-foreground/10 rounded-xl">
            No meetings found
          </div>
        )}
      </div>
    </div>
  );
}
