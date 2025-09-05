import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";

async function GetPdf(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // CORSヘッダーを設定
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // OPTIONSリクエストの処理
    if (request.method === 'OPTIONS') {
      return {
        status: 200,
        headers,
        body: ''
      };
    }

    // URLパラメータからファイルパスを取得
    const url = new URL(request.url);
    const filePath = url.searchParams.get('path');

    if (!filePath) {
      return {
        status: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'ファイルパスが指定されていません'
        })
      };
    }

    // Azure Storage接続文字列を取得
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 
                            process.env.AzureWebJobsStorage ||
                            process.env.STORAGE_CONNECTION_STRING;
    
    if (!connectionString) {
      context.error('Azure Storage接続文字列が設定されていません');
      return {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'ストレージ設定エラー: 接続文字列が設定されていません'
        })
      };
    }

    // BlobServiceClientを作成
    let blobServiceClient: BlobServiceClient;
    
    try {
      if (connectionString === "UseDevelopmentStorage=true") {
        const azuriteConnectionString = "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;";

        blobServiceClient = BlobServiceClient.fromConnectionString(azuriteConnectionString);
      } else {
        blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      }
    } catch (clientError) {
      context.error('BlobServiceClient作成エラー:', clientError);
      return {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Azure Storage クライアントの作成に失敗しました'
        })
      };
    }

    const containerName = 'pdfs';
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(filePath);

    // Blobの存在確認
    try {
      const exists = await blockBlobClient.exists();
      if (!exists) {
        return {
          status: 404,
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            error: 'ファイルが見つかりません'
          })
        };
      }
    } catch (existsError) {
      context.error('Blob存在確認エラー:', existsError);
      return {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'ファイルの確認に失敗しました'
        })
      };
    }

    // Blobのプロパティを取得
    let blobProperties;
    try {
      blobProperties = await blockBlobClient.getProperties();
    } catch (propertiesError) {
      context.error('Blobプロパティ取得エラー:', propertiesError);
      return {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'ファイル情報の取得に失敗しました'
        })
      };
    }

    // Blobの内容をダウンロード
    let blobData;
    try {
      const downloadResponse = await blockBlobClient.download();
      const chunks: Buffer[] = [];
      for await (const chunk of downloadResponse.readableStreamBody!) {
        chunks.push(Buffer.from(chunk));
      }
      blobData = Buffer.concat(chunks);
    } catch (downloadError) {
      context.error('Blobダウンロードエラー:', downloadError);
      return {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'ファイルのダウンロードに失敗しました'
        })
      };
    }

    // PDFファイルとして配信
    return {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filePath.split('/').pop()}"`,
        'Content-Length': blobData.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
      body: blobData
    };

  } catch (error) {
    context.error('PDF取得エラー:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'PDFの取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

app.http('GetPdf', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'get-pdf',
  handler: GetPdf
});

export { GetPdf };
