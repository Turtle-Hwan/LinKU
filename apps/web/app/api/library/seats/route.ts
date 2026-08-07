import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type {
  LibraryApiResponse,
  LibraryLoginData,
  LibraryLoginRequest,
  LibrarySeatRoomsData,
  LibrarySeatRoom,
} from "@linku/shared-types";

const LIBRARY_BASE_URL = "https://library.konkuk.ac.kr";
const LIBRARY_API_URL = `${LIBRARY_BASE_URL}/pyxis-api`;

interface LibrarySeatRoomWithReservationUrl extends LibrarySeatRoom {
  reservationUrl: string;
}

function getLibraryReservationUrl(roomId: number) {
  return `${LIBRARY_BASE_URL}/library-services/smuf/reading-rooms/${roomId}`;
}

async function loginToLibrary(studentId: string, password: string) {
  const requestBody: LibraryLoginRequest = {
    loginId: studentId,
    password,
    isFamilyLogin: false,
    isMobile: false,
  };

  const response = await fetch(`${LIBRARY_API_URL}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
    },
    body: JSON.stringify(requestBody),
    credentials: "include",
  });

  const data = (await response.json()) as LibraryApiResponse<LibraryLoginData>;
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Failed to sign in to the library API.");
  }

  return data.data.accessToken;
}

async function fetchSeatRooms(accessToken: string) {
  const response = await fetch(
    `${LIBRARY_API_URL}/1/seat-rooms?smufMethodCode=PC&branchGroupId=1`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "pyxis-auth-token": accessToken,
      },
      credentials: "include",
    },
  );

  const data = (await response.json()) as LibraryApiResponse<LibrarySeatRoomsData>;
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Failed to fetch library seat rooms.");
  }

  return data.data.list.map((room) => ({
    ...room,
    reservationUrl: getLibraryReservationUrl(room.id),
  })) satisfies LibrarySeatRoomWithReservationUrl[];
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      studentId?: string;
      password?: string;
    };

    if (!body.studentId || !body.password) {
      return NextResponse.json(
        {
          message: "Missing studentId or password.",
        },
        { status: 400 },
      );
    }

    const accessToken = await loginToLibrary(body.studentId, body.password);
    const rooms = await fetchSeatRooms(accessToken);

    return NextResponse.json({
      rooms,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to load library seats.",
      },
      { status: 500 },
    );
  }
}
