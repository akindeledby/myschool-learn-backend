import "dotenv/config";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

const client = new STSClient({
  region: process.env.AWS_REGION,
});

const identity = await client.send(
  new GetCallerIdentityCommand({})
);

console.log(identity);