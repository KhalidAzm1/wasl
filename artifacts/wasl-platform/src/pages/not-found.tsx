import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 text-white">
      <Card className="w-full max-w-md mx-4 glass-card border-white/10">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-bold">404 - صفحة غير موجودة</h1>
          </div>
          <p className="mt-4 text-sm text-white/60 text-right">
            عذراً، الصفحة التي تبحث عنها غير موجودة.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
