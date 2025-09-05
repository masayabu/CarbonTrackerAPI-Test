import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";

const connectionString = process.env.AzureWebJobsStorage!;
const productionTable = "ProductionTable";
const userGroupTable = "UserGroupTable";
const groupTable = "GroupsTable";

interface GroupRankingData {
  groupId: string;
  groupName: string;
  thisMonthCharcoal: number;
  thisMonthCO2Reduction: number;
  thisYearCO2Reduction: number;
  totalCO2ReductionShortTerm: number;
  totalCO2ReductionLongTerm: number;
  introductionPdfUrl?: string | null;
}

async function getGroupRanking(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const prodClient = TableClient.fromConnectionString(connectionString, productionTable);
    const userGroupClient = TableClient.fromConnectionString(connectionString, userGroupTable);
    const groupClient = TableClient.fromConnectionString(connectionString, groupTable);

    // 現在の年月を取得
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // グループ情報を取得
    const groupMap = new Map<string, { name: string; introductionPdfUrl?: string | null }>();
    for await (const group of groupClient.listEntities()) {
      const groupId = group.rowKey as string;
      const groupName = group.name as string;
      const introductionPdfUrl = group.introductionPdfUrl as string | null | undefined;
      groupMap.set(groupId, { name: groupName, introductionPdfUrl });
    }

    // userId -> groupId のマップを構築
    const userToGroupMap = new Map<string, string>();
    for await (const entity of userGroupClient.listEntities()) {
      const userId = entity.partitionKey as string;
      const groupId = entity.rowKey as string;
      if (!userToGroupMap.has(userId)) {
        userToGroupMap.set(userId, groupId);
      }
    }

    // グループ別のデータを集計
    const groupDataMap = new Map<string, {
      thisMonthCharcoal: number;
      thisMonthCO2Reduction: number;
      thisYearCO2Reduction: number;
      totalCO2ReductionShortTerm: number;
      totalCO2ReductionLongTerm: number;
    }>();

    for await (const record of prodClient.listEntities()) {
      const userId = record.userId as string | undefined;
      const date = record.date as string;
      const charcoalProduced = Number(record.charcoalProduced ?? 0);
      const co2Reduction = Number(record.co2Reduction ?? 0);

      if (!userId || !date) continue;

      const groupId = userToGroupMap.get(userId) || "unknown";
      
      if (!groupDataMap.has(groupId)) {
        groupDataMap.set(groupId, {
          thisMonthCharcoal: 0,
          thisMonthCO2Reduction: 0,
          thisYearCO2Reduction: 0,
          totalCO2ReductionShortTerm: 0,
          totalCO2ReductionLongTerm: 0,
        });
      }

      const groupData = groupDataMap.get(groupId)!;

      // 日付を解析
      const recordDate = new Date(date);
      const recordYear = recordDate.getFullYear();
      const recordMonth = recordDate.getMonth() + 1;

      // 累積データ
      groupData.totalCO2ReductionShortTerm += co2Reduction;
      groupData.totalCO2ReductionLongTerm += co2Reduction * 0.8;

      // 今年のデータ
      if (recordYear === currentYear) {
        groupData.thisYearCO2Reduction += co2Reduction;
      }

      // 今月のデータ
      if (recordYear === currentYear && recordMonth === currentMonth) {
        groupData.thisMonthCharcoal += charcoalProduced;
        groupData.thisMonthCO2Reduction += co2Reduction;
      }
    }

    // 結果を配列に変換
    const result: GroupRankingData[] = [];
    for (const [groupId, data] of groupDataMap) {
      const groupInfo = groupMap.get(groupId);
      const groupName = groupInfo?.name || "不明なグループ";
      const introductionPdfUrl = groupInfo?.introductionPdfUrl || null;
      
      result.push({
        groupId,
        groupName,
        thisMonthCharcoal: data.thisMonthCharcoal,
        thisMonthCO2Reduction: data.thisMonthCO2Reduction,
        thisYearCO2Reduction: data.thisYearCO2Reduction,
        totalCO2ReductionShortTerm: data.totalCO2ReductionShortTerm,
        totalCO2ReductionLongTerm: data.totalCO2ReductionLongTerm,
        introductionPdfUrl,
      });
    }

    // 累積炭素固定量でソート（降順）
    result.sort((a, b) => b.totalCO2ReductionShortTerm - a.totalCO2ReductionShortTerm);

    return {
      status: 200,
      body: JSON.stringify(result),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    };
  } catch (error) {
    context.error("Error in getGroupRanking:", error);
    return {
      status: 500,
      body: JSON.stringify({ error: "Internal server error" }),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    };
  }
}

app.http("group-ranking", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "group-ranking",
  handler: getGroupRanking,
});

export { getGroupRanking as GroupRanking };
