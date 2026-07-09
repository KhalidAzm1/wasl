import React from 'react';
import { useGetDashboardSummary, useGetActivityFeed, useListBanks } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Activity, AlertTriangle, Building2, CheckCircle2, Clock, PlayCircle } from 'lucide-react';
import { Link } from 'wouter';
import { BankLogo } from '@/components/BankLogo';
import logoUrl from '@assets/wasl_brand/wasl_logo_2026.png';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: activities, isLoading: isLoadingActivities } = useGetActivityFeed();
  const { data: banks, isLoading: isLoadingBanks } = useListBanks();

  if (isLoadingSummary || isLoadingBanks) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-white/50">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const kpis = [
    { label: 'إجمالي البنوك', value: summary.totalBanks, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'قيد التنفيذ', value: summary.inProgress, icon: PlayCircle, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { label: 'مكتمل', value: summary.completed, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'متأخر', value: summary.delayed, icon: Clock, color: 'text-orange-400', bg: 'bg-orange-400/10' },
    { label: 'مخاطر عالية', value: summary.highRisks, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10' },
  ];

  return (
    <div className="p-8 pb-24 max-w-7xl mx-auto w-full space-y-8">
      <header className="flex justify-between items-end mb-8 gap-6">
        <div className="flex items-center gap-5">
          <img src={logoUrl} alt="Wasl" className="w-16 h-auto drop-shadow-lg hidden sm:block" />
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-white to-white/60 mb-2">
              لوحة القيادة التنفيذية
            </h1>
            <p className="text-white/50 text-lg">ملخص حالة الربط مع البنوك وجهات التمويل</p>
          </div>
        </div>
        <div className="text-left">
          <p className="text-white/40 text-sm">تاريخ التحديث</p>
          <p className="text-white/80 font-mono">{new Date().toLocaleDateString('ar-SA')}</p>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="h-full">
              <CardContent className="p-6 flex flex-col justify-between h-full">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl ${kpi.bg}`}>
                    <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
                  </div>
                  <span className="text-3xl font-bold font-mono">{kpi.value}</span>
                </div>
                <p className="text-white/60 font-medium">{kpi.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Charts Area */}
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>توزيع الحالات (Status Breakdown)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.statusBreakdown} layout="vertical" margin={{ left: 10, right: 20, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.5)' }} />
                    <YAxis
                      dataKey="label"
                      type="category"
                      width={190}
                      stroke="rgba(255,255,255,0.2)"
                      tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 11 }}
                      tickFormatter={(value: string) => (value.length > 26 ? `${value.slice(0, 24)}…` : value)}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                      contentStyle={{ backgroundColor: 'rgba(10,15,30,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                      {summary.statusBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>التصنيف (Category)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary.categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="label"
                      >
                        {summary.categoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(10,15,30,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-4 justify-center mt-4">
                  {summary.categoryBreakdown.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-white/70">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      {entry.label} ({entry.count})
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>مستويات المخاطر (Risks)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary.riskBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="label"
                      >
                        {summary.riskBreakdown.map((entry, index) => {
                          const color = entry.label === 'High' ? 'hsl(var(--destructive))' : 
                                        entry.label === 'Medium' ? '#f59e0b' : '#10b981';
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(10,15,30,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sidebar Area */}
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                تنبيهات تنفيذية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {banks?.filter(b => b.riskLevel === 'High' || b.priorityImpact === 'HOT').slice(0, 5).map(bank => (
                <div key={bank.id} className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 p-1 flex items-center justify-center shrink-0">
                        <BankLogo src={bank.logoUrl} alt={bank.nameEn} />
                      </div>
                      <Link href={`/bank/${bank.id}`} className="font-semibold hover:text-primary transition-colors truncate">
                        {bank.nameAr}
                      </Link>
                    </div>
                    <Badge variant="destructive" className="shrink-0">{bank.riskLevel === 'High' ? 'خطر عالي' : 'أولوية قصوى'}</Badge>
                  </div>
                  <p className="text-sm text-white/50 truncate">{bank.nextAction || 'لا يوجد إجراء محدد'}</p>
                </div>
              ))}
              {(!banks || banks.filter(b => b.riskLevel === 'High' || b.priorityImpact === 'HOT').length === 0) && (
                <div className="text-center py-6 text-white/40">لا توجد تنبيهات حالية</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                أحدث النشاطات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {activities?.slice(0, 6).map((activity, idx) => {
                  const activityBank = banks?.find(b => b.id === activity.bankId);
                  return (
                    <div key={activity.id} className="relative pl-6 before:absolute before:right-2 before:top-2 before:bottom-[-24px] before:w-[1px] before:bg-white/10 last:before:hidden" dir="rtl">
                      <div className="absolute right-0 top-1.5 w-4 h-4 rounded-full bg-primary/20 border-2 border-primary" />
                      <div className="pr-6">
                        <p className="text-sm font-medium mb-1">
                          <span className="text-white/60">{activity.type === 'meeting' ? 'اجتماع' : activity.type === 'risk' ? 'خطر' : 'تحديث'}: </span>
                          {activity.description}
                        </p>
                        <div className="flex justify-between items-center text-xs text-white/40">
                          <Link href={`/bank/${activity.bankId}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                            {activityBank && (
                              <div className="w-5 h-5 rounded bg-white/5 border border-white/10 p-0.5 flex items-center justify-center shrink-0">
                                <BankLogo src={activityBank.logoUrl} alt={activityBank.nameEn} />
                              </div>
                            )}
                            {activity.bankNameAr}
                          </Link>
                          <span dir="ltr">{new Date(activity.date).toLocaleDateString('ar-SA')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
