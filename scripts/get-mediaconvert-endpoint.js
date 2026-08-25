import "dotenv/config";

import {
  MediaConvertClient,
  DescribeEndpointsCommand,
} from "@aws-sdk/client-mediaconvert";

async function main() {
  const client =
    new MediaConvertClient({
      region:
        process.env.AWS_REGION,
    });

  const endpoints =
    await client.send(
      new DescribeEndpointsCommand({})
    );

  console.log(
    "MediaConvert Endpoint:"
  );

  console.log(
    endpoints.Endpoints?.[0]?.Url
  );
}

main().catch(console.error);

// npm install @aws-sdk/client-mediaconvert