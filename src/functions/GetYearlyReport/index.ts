import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { connectionString, tableName, partitionKey } from "../../config";

async function GetYearlyReport(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("Processing GET /reports/yearly/:year");

  const yearParam = request.params.year;
  if (!yearParam || isNaN(Number(yearParam))) {
    return {
      status: 400,
      body: "Invalid or missing year parameter",
    };
  }
  const year = Number(yearParam);

  const client = TableClient.fromConnectionString(connectionString, tableName);

  const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    totalBamboo: 0,
    charcoalProduced: 0,
    charcoalVolume: 0,
    totalCO2Reduction: 0,
  }));

  try {
    const entities = client.listEntities<Record<string, any>>({
      queryOptions: {
        filter: `PartitionKey eq '${partitionKey}'`,
      },
    });

    for await (const entity of entities) {
      const date = new Date(entity.date);
      if (date.getFullYear() !== year) continue;

      const month = date.getMonth(); // 0-based
      monthlyTotals[month].totalBamboo += Number(entity.bambooAmount || 0);
      monthlyTotals[month].charcoalProduced += Number(entity.charcoalProduced || 0);
      monthlyTotals[month].charcoalVolume += Number(entity.charcoalVolume || 0);
      monthlyTotals[month].totalCO2Reduction += Number(entity.co2Reduction || 0);
    }

    return {
      status: 200,
      headers: { 
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
        },
      body: JSON.stringify(monthlyTotals),
    };
  } catch (error: any) {
    context.log(`Error: ${error.message}`);
    return {
      status: 500,
      body: "Internal Server Error",
    };
  }
}

app.http("GetYearlyReport", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "reports/yearly/{year}",
  handler: GetYearlyReport,
});

export { GetYearlyReport };
