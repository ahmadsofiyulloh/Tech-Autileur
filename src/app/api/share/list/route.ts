import { NextResponse, type NextRequest } from "next/server";
import { listShareListPage } from "@/lib/server/share-list";
import {
  normalizeShareListPage,
  normalizeShareListPageSize,
  normalizeShareListSearch,
  normalizeSharePlatformParam,
  SHARE_LIST_DESKTOP_PAGE_SIZE,
} from "@/lib/share/share-list-contract";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const platformParam = searchParams.get("platform");
    const platform = normalizeSharePlatformParam(platformParam);

    if (!platform) {
      return NextResponse.json(
        { error: "Platform parameter required." },
        { status: 400 },
      );
    }

    const page = normalizeShareListPage(searchParams.get("page"));
    const pageSize = normalizeShareListPageSize(
      searchParams.get("page_size"),
      SHARE_LIST_DESKTOP_PAGE_SIZE,
    );
    const search = normalizeShareListSearch(searchParams.get("q"));

    const result = await listShareListPage({
      platform,
      page,
      pageSize,
      search: search || null,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Share list gagal dimuat." },
      { status: 500 },
    );
  }
}
