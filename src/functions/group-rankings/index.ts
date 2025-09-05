import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";

const connectionString = process.env.AzureWebJobsStorage!;
const productionTable = "ProductionTable";
const userGroupTable = "UserGroupTable";

async function getGroupRankings(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const prodClient = TableClient.fromConnectionString(connectionString, productionTable);
  const userGroupClient = TableClient.fromConnectionString(connectionString, userGroupTable);

  // userId -> groupId のマップを構築（複数グループ参加も考慮して最初の1件に限定）
  const userToGroupMap = new Map<string, string>();

  for await (const entity of userGroupClient.listEntities()) {
    const userId = entity.partitionKey as string;
    const groupId = entity.rowKey as string;
    // すでに登録されている場合は無視（1ユーザー1グループと仮定）
    if (!userToGroupMap.has(userId)) {
      userToGroupMap.set(userId, groupId);
    }
  }

  // グループ別のCO2削減量を集計
  const groupCO2Map: Record<string, number> = {};

  for await (const record of prodClient.listEntities()) {
    const userId = record.userId as string | undefined;
    const co2 = Number(record.co2Reduction ?? 0);

    if (!userId) continue;

    const groupId = userToGroupMap.get(userId) || "unknown";

    if (!groupCO2Map[groupId]) {
      groupCO2Map[groupId] = 0;
    }

    groupCO2Map[groupId] += co2;
  }

  // ランキングを降順で作成
  const rankings = Object.entries(groupCO2Map)
    .map(([groupId, totalCO2]) => ({ groupId, totalCO2 }))
    .sort((a, b) => b.totalCO2 - a.totalCO2);

  return {
    status: 200,
    body: JSON.stringify(rankings),
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  };
}

app.http("group-rankings", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "group-rankings",
  handler: getGroupRankings,
});

export { getGroupRankings as GroupRankings };
