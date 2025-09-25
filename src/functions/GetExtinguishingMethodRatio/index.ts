import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { connectionString, tableName, partitionKey } from "../../config";

async function GetExtinguishingMethodRatio(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("Processing GET /reports/extinguishing-method-ratio/:year");

  const yearParam = request.params.year;
  if (!yearParam || isNaN(Number(yearParam))) {
    return {
      status: 400,
      body: "Invalid or missing year parameter",
    };
  }
  const year = Number(yearParam);

  const client = TableClient.fromConnectionString(connectionString, tableName);

  // 消化方法別の生産量合計を格納するオブジェクト
  const extinguishingMethodTotals: { [key: string]: number } = {
    water: 0,
    oxygen: 0,
  };

  let totalCharcoalProduced = 0;

  try {
    const entities = client.listEntities<Record<string, any>>({
      queryOptions: {
        filter: `PartitionKey eq '${partitionKey}'`,
      },
    });

    for await (const entity of entities) {
      const date = new Date(entity.date);
      if (date.getFullYear() !== year) continue;

      const charcoalProduced = Number(entity.charcoalProduced || 0);
      const extinguishingMethod = entity.extinguishingMethod;

      if (charcoalProduced > 0 && extinguishingMethod) {
        // 消化方法がwaterまたはoxygenの場合のみ集計
        if (extinguishingMethod === 'water' || extinguishingMethod === 'oxygen') {
          extinguishingMethodTotals[extinguishingMethod] += charcoalProduced;
          totalCharcoalProduced += charcoalProduced;
        }
      }
    }

    // 割合を計算
    const ratios = {
      water: totalCharcoalProduced > 0 ? (extinguishingMethodTotals.water / totalCharcoalProduced) * 100 : 0,
      oxygen: totalCharcoalProduced > 0 ? (extinguishingMethodTotals.oxygen / totalCharcoalProduced) * 100 : 0,
    };

    const result = {
      year,
      totalCharcoalProduced,
      extinguishingMethodTotals,
      ratios,
      summary: {
        water: {
          amount: extinguishingMethodTotals.water,
          percentage: Math.round(ratios.water * 100) / 100
        },
        oxygen: {
          amount: extinguishingMethodTotals.oxygen,
          percentage: Math.round(ratios.oxygen * 100) / 100
        }
      }
    };

    return {
      status: 200,
      headers: { 
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    context.log(`Error: ${error.message}`);
    return {
      status: 500,
      body: "Internal Server Error",
    };
  }
}

app.http("GetExtinguishingMethodRatio", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "reports/extinguishing-method-ratio/{year}",
  handler: GetExtinguishingMethodRatio,
});

export { GetExtinguishingMethodRatio };
