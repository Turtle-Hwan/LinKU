import { NextResponse } from "next/server";

interface EcampusTodoItem {
  id: string;
  title: string;
  subject: string;
  dDay: string;
  dueDate: string;
  lecturePath: string;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readCookieHeader(response: Response) {
  const getSetCookie = (response.headers as Headers & {
    getSetCookie?: () => string[];
  }).getSetCookie;

  if (typeof getSetCookie === "function") {
    return getSetCookie()
      .map((cookie) => cookie.split(";", 1)[0])
      .join("; ");
  }

  const singleCookie = response.headers.get("set-cookie");
  return singleCookie ? singleCookie.split(";", 1)[0] : "";
}

function parseTodoBlocks(html: string) {
  return [...html.matchAll(/<div[^>]*class="[^"]*todo_wrap[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi)]
    .map((match, index) => {
      const block = match[0];
      const title =
        block.match(/class="todo_title"[^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ?? "";
      const subject =
        block.match(/class="todo_subjt"[^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ?? "";
      const dDay =
        block.match(/class="todo_d_day"[^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ?? "";
      const dueDate =
        block.match(/class="todo_date"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] ??
        "";
      const onclickMatch = block.match(
        /goLecture\('.*?','(.*?)','(.*?)','(.*?)'\)/,
      );

      if (!title || !onclickMatch) {
        return null;
      }

      return {
        id: `ecampus-${index}`,
        title: decodeHtml(title),
        subject: decodeHtml(subject),
        dDay: decodeHtml(dDay),
        dueDate: decodeHtml(dueDate),
        lecturePath: `/ilos/mp/todo_list_connect.acl?SEQ=${onclickMatch[1]}&gubun=${onclickMatch[2]}&KJKEY=${onclickMatch[3]}`,
      } satisfies EcampusTodoItem;
    })
    .filter((item): item is EcampusTodoItem => item !== null);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      password?: string;
    };

    if (!body.userId || !body.password) {
      return NextResponse.json({ message: "Missing credentials." }, { status: 400 });
    }

    const loginResponse = await fetch(
      "https://ecampus.konkuk.ac.kr/ilos/lo/login.acl?data=jsonLogin",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: new URLSearchParams({
          usr_id: body.userId,
          usr_pwd: body.password,
          campus_div: "1",
          encoding: "utf-8",
        }),
        redirect: "manual",
      },
    );

    const loginText = await loginResponse.text();
    const loginPayload = JSON.parse(
      loginText.replace(/\s*jsonLogin\s*\(\s*/, "").replace(/\s*\)\s*;?\s*$/, ""),
    ) as { isError?: boolean; message?: string };

    if (loginPayload.isError) {
      return NextResponse.json(
        { message: loginPayload.message || "eCampus login failed." },
        { status: 401 },
      );
    }

    const cookieHeader = readCookieHeader(loginResponse);
    const todoResponse = await fetch("https://ecampus.konkuk.ac.kr/ilos/mp/todo_list.acl", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
        Cookie: cookieHeader,
      },
      body: new URLSearchParams({
        todoKjList: "",
        chk_cate: "ALL",
        encoding: "utf-8",
      }),
    });

    const todoHtml = await todoResponse.text();

    if (todoHtml.includes("jsonLogin") || todoHtml.includes("alert('")) {
      return NextResponse.json(
        { message: "eCampus session could not be established." },
        { status: 401 },
      );
    }

    return NextResponse.json(parseTodoBlocks(todoHtml));
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to load eCampus todos.",
      },
      { status: 500 },
    );
  }
}
