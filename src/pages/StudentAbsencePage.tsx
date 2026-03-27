import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFinance } from "@/context/FinanceContext";
import AppLayout from "@/components/AppLayout";
import StudentManager from "@/components/studentAbsence/StudentManager";
import DailyAbsenceTracker from "@/components/studentAbsence/DailyAbsenceTracker";
import AbsenceReports from "@/components/studentAbsence/AbsenceReports";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AbsenceStatistics from "@/components/studentAbsence/AbsenceStatistics";
import SmsGatewaySettings from "@/components/studentAbsence/SmsGatewaySettings";
import AjyalIntegration from "@/components/studentAbsence/AjyalIntegration";
import { Users, ClipboardCheck, FileBarChart, BarChart3, Smartphone, GraduationCap } from "lucide-react";

export default function StudentAbsencePage() {
  const { user, schoolName } = useAuth();
  const { state } = useFinance();
  const userId = user?.id || "anonymous";

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4" dir="rtl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6" />
          غياب الطلبة
        </h1>

        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="daily" className="flex items-center gap-1">
              <ClipboardCheck className="w-4 h-4" />
              الرصد اليومي
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              إدارة الطلبة
            </TabsTrigger>
            <TabsTrigger value="statistics" className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              الإحصائيات
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-1">
              <FileBarChart className="w-4 h-4" />
              التقارير
            </TabsTrigger>
            <TabsTrigger value="sms" className="flex items-center gap-1">
              <Smartphone className="w-4 h-4" />
              إعدادات SMS
            </TabsTrigger>
            <TabsTrigger value="ajyal" className="flex items-center gap-1">
              <GraduationCap className="w-4 h-4" />
              منصة أجيال
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily">
            <DailyAbsenceTracker userId={userId} schoolName={schoolName || ""} />
          </TabsContent>
          <TabsContent value="students">
            <StudentManager userId={userId} schoolName={schoolName || ""} directorateName={state.directorateName || ""} />
          </TabsContent>
          <TabsContent value="statistics">
            <AbsenceStatistics
              userId={userId}
              schoolName={schoolName || ""}
              directorateName={state.directorateName || ""}
              principalName={state.directorName || ""}
            />
          </TabsContent>
          <TabsContent value="reports">
            <AbsenceReports
              userId={userId}
              schoolName={schoolName || ""}
              directorateName={state.directorateName || ""}
              principalName={state.directorName || ""}
            />
          </TabsContent>
          <TabsContent value="sms">
            <SmsGatewaySettings />
          </TabsContent>
          <TabsContent value="ajyal">
            <AjyalIntegration userId={userId} schoolName={schoolName || ""} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}