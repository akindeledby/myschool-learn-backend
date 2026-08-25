import {
  MediaConvertClient,
} from "@aws-sdk/client-mediaconvert";

export const mediaConvert =
  new MediaConvertClient({
    region:
      process.env.AWS_REGION,

    endpoint:
      process.env.MEDIACONVERT_ENDPOINT,
  });