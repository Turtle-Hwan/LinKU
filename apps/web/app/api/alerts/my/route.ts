import { NextResponse } from "next/server";
import type { GeneralAlert } from "@linku/shared-types";
import {
  getLinkuBackendSnapshot,
  readLinkuBackendSession,
  requestLinkuBackend,
} from "@/lib/linku-backend";

interface MyAlertsResponse {
  alertResponseList?: Array<{
    alertId: number;
    departmentName: string;
    url: string;
    title: string;
    postTime: string;
    content: string;
  }>;
}

interface MyAlertsSnapshot {
  configured: boolean;
  connected: boolean;
  mode: "disconnected" | "guest" | "member";
  alerts: GeneralAlert[];
  message?: string;
}

function mapAlerts(data: MyAlertsResponse | null | undefined) {
  if (!data?.alertResponseList) {
    return [] as GeneralAlert[];
  }

  return data.alertResponseList.map((item) => ({
    alertId: item.alertId,
    title: item.title,
    content: item.content,
    category: item.departmentName as GeneralAlert["category"],
    url: item.url,
    publishedAt: item.postTime,
  }));
}

export async function GET() {
  const backendSnapshot = await getLinkuBackendSnapshot();

  if (!backendSnapshot.connected || backendSnapshot.mode !== "member") {
    return NextResponse.json({
      ...backendSnapshot,
      alerts: [],
    } satisfies MyAlertsSnapshot);
  }

  const session = await readLinkuBackendSession();

  if (!session) {
    return NextResponse.json(
      {
        ...backendSnapshot,
        connected: false,
        mode: "disconnected",
        alerts: [],
      } satisfies MyAlertsSnapshot,
    );
  }

  const result = await requestLinkuBackend<MyAlertsResponse>("/alerts/my", {
    method: "GET",
    session,
  });

  return NextResponse.json(
    {
      ...backendSnapshot,
      alerts: result.ok ? mapAlerts(result.data) : [],
      message: result.ok ? undefined : result.message,
    } satisfies MyAlertsSnapshot,
    { status: result.ok ? 200 : result.status },
  );
}
