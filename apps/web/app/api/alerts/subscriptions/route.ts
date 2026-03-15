import { NextResponse } from "next/server";
import type { Department, Subscription } from "@linku/shared-types";
import {
  getLinkuBackendSnapshot,
  readLinkuBackendSession,
  requestLinkuBackend,
} from "@/lib/linku-backend";

interface DepartmentConfigResponse {
  departmentConfigList?: Array<{
    departmentConfigId: number;
    departmentConfigName: string;
  }>;
}

interface SubscriptionSnapshot {
  configured: boolean;
  connected: boolean;
  mode: "disconnected" | "guest" | "member";
  kuMail?: string;
  departments: Department[];
  subscriptions: Subscription[];
  message?: string;
}

function mapDepartments(data: DepartmentConfigResponse | null | undefined) {
  if (!data?.departmentConfigList) {
    return [] as Department[];
  }

  return data.departmentConfigList.map((item) => ({
    id: item.departmentConfigId,
    name: item.departmentConfigName,
  })) as Department[];
}

function mapSubscriptions(data: DepartmentConfigResponse | null | undefined) {
  if (!data?.departmentConfigList) {
    return [] as Subscription[];
  }

  return data.departmentConfigList.map((item) => ({
    subscriptionId: item.departmentConfigId,
    department: {
      id: item.departmentConfigId,
      name: item.departmentConfigName,
    } as Department,
    createdAt: "",
  }));
}

async function buildSnapshot(message?: string): Promise<SubscriptionSnapshot> {
  const backendSnapshot = await getLinkuBackendSnapshot();

  if (!backendSnapshot.connected || backendSnapshot.mode !== "member") {
    return {
      ...backendSnapshot,
      departments: [],
      subscriptions: [],
      message,
    };
  }

  const session = await readLinkuBackendSession();

  if (!session) {
    return {
      ...backendSnapshot,
      connected: false,
      mode: "disconnected",
      departments: [],
      subscriptions: [],
      message,
    };
  }

  const [departmentsResult, subscriptionsResult] = await Promise.all([
    requestLinkuBackend<DepartmentConfigResponse>("/alerts/subscription", {
      session,
      method: "GET",
    }),
    requestLinkuBackend<DepartmentConfigResponse>("/alerts/subscription/my", {
      session,
      method: "GET",
    }),
  ]);

  const nextMessage =
    !departmentsResult.ok
      ? departmentsResult.message
      : !subscriptionsResult.ok
        ? subscriptionsResult.message
        : message;

  return {
    ...backendSnapshot,
    departments: departmentsResult.ok ? mapDepartments(departmentsResult.data) : [],
    subscriptions: subscriptionsResult.ok
      ? mapSubscriptions(subscriptionsResult.data)
      : [],
    message: nextMessage,
  };
}

export async function GET() {
  return NextResponse.json(await buildSnapshot());
}

export async function POST(request: Request) {
  const session = await readLinkuBackendSession();
  const snapshot = await getLinkuBackendSnapshot();

  if (!session || snapshot.mode !== "member") {
    return NextResponse.json(
      {
        ...(await buildSnapshot("A connected LinKU member account is required.")),
      },
      { status: 401 },
    );
  }

  const body = (await request.json()) as {
    departmentId?: number;
  };

  if (typeof body.departmentId !== "number") {
    return NextResponse.json(
      {
        ...(await buildSnapshot("A department id is required.")),
      },
      { status: 400 },
    );
  }

  const result = await requestLinkuBackend<unknown>(
    `/alerts/subscription/${body.departmentId}`,
    {
      method: "POST",
      session,
    },
  );

  return NextResponse.json(await buildSnapshot(result.ok ? undefined : result.message), {
    status: result.ok ? 200 : result.status,
  });
}

export async function DELETE(request: Request) {
  const session = await readLinkuBackendSession();
  const snapshot = await getLinkuBackendSnapshot();

  if (!session || snapshot.mode !== "member") {
    return NextResponse.json(
      {
        ...(await buildSnapshot("A connected LinKU member account is required.")),
      },
      { status: 401 },
    );
  }

  const body = (await request.json()) as {
    departmentId?: number;
  };

  if (typeof body.departmentId !== "number") {
    return NextResponse.json(
      {
        ...(await buildSnapshot("A department id is required.")),
      },
      { status: 400 },
    );
  }

  const result = await requestLinkuBackend<unknown>(
    `/alerts/subscription/${body.departmentId}`,
    {
      method: "DELETE",
      session,
    },
  );

  return NextResponse.json(await buildSnapshot(result.ok ? undefined : result.message), {
    status: result.ok ? 200 : result.status,
  });
}
