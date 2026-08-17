import { readPublicRoom } from "../public-room";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const accountId = new URL(request.url).searchParams.get("accountId")?.trim() ?? "";
  return readPublicRoom(accountId);
}
