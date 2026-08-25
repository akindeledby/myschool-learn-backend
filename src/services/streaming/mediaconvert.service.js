import {
  MediaConvertClient,
  CreateJobCommand,
} from "@aws-sdk/client-mediaconvert";

const mediaConvert =
  new MediaConvertClient({
    region: process.env.AWS_REGION,
    endpoint:
      process.env.MEDIACONVERT_ENDPOINT,
  });

export async function createHlsJob({
  inputKey,
  topicId,
  hasAudio = true,
}) {
  const bucket =
    process.env.REMOTION_AWS_BUCKET_NAME;

  const roleArn =
    process.env.MEDIACONVERT_ROLE_ARN;

  if (!bucket) {
    throw new Error(
      "REMOTION_AWS_BUCKET_NAME missing"
    );
  }

  if (!roleArn) {
    throw new Error(
      "MEDIACONVERT_ROLE_ARN missing"
    );
  }

  const destination =
    `s3://${bucket}/hls/${topicId}/`;

  const output = {
    NameModifier: "_720p",

    VideoDescription: {
      Width: 1280,
      Height: 720,

      CodecSettings: {
        Codec: "H_264",

        H264Settings: {
          Bitrate: 3000000,
          RateControlMode: "CBR",
          CodecLevel: "AUTO",
          CodecProfile: "MAIN",
          GopSize: 48,
          GopSizeUnits: "FRAMES",
        },
      },
    },

    ContainerSettings: {
      Container: "M3U8",
      M3u8Settings: {},
    },
  };

  if (hasAudio) {
    output.AudioDescriptions = [
      {
        AudioSourceName:
          "Audio Selector 1",

        CodecSettings: {
          Codec: "AAC",

          AacSettings: {
            Bitrate: 128000,
            CodingMode:
              "CODING_MODE_2_0",
            SampleRate: 48000,
          },
        },
      },
    ];
  }

  const command =
    new CreateJobCommand({
      Role: roleArn,

      Settings: {
        Inputs: [
          {
            FileInput:
              `s3://${bucket}/${inputKey}`,

            AudioSelectors: hasAudio
              ? {
                  "Audio Selector 1":
                    {
                      DefaultSelection:
                        "DEFAULT",
                    },
                }
              : undefined,
          },
        ],

        OutputGroups: [
          {
            Name:
              "Apple HLS",

            OutputGroupSettings: {
              Type:
                "HLS_GROUP_SETTINGS",

              HlsGroupSettings: {
                Destination:
                  destination,

                SegmentLength: 6,

                MinSegmentLength: 0,

                ManifestDurationFormat:
                  "INTEGER",

                OutputSelection:
                  "MANIFESTS_AND_SEGMENTS",

                StreamInfResolution:
                  "INCLUDE",
              },
            },

            Outputs: [output],
          },
        ],
      },
    });

  const response =
    await mediaConvert.send(command);

  return response.Job;
}