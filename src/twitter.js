import * as dotenv from "dotenv";
dotenv.config();

import { TwitterApi, ETwitterStreamEvent } from "twitter-api-v2";

import { callTextToImageReplicate } from "./replicate.js";
import { prepareFinalPrompt, urlToBuffer, log, logError } from "./util.js";

const {
  TWITTER_API_KEY,
  TWITTER_API_SECRET,
  TWITTER_API_BEARER,
  TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_SECRET,
  TWITTER_BOT_HANDLE,
  TWITTER_BOT_ID
} = process.env;

const twitterClientV1 = new TwitterApi({
  appKey: TWITTER_API_KEY,
  appSecret: TWITTER_API_SECRET,
  accessToken: TWITTER_ACCESS_TOKEN,
  accessSecret: TWITTER_ACCESS_SECRET
}).readWrite;

const twitterClient = new TwitterApi(TWITTER_API_BEARER);
const readWriteClient = twitterClient.readWrite;

const TWITTER_STREAM_RULE = `@${TWITTER_BOT_HANDLE}`;

const getTweetHasMention = async id => {
  try {
    const { data } = await readWriteClient.v2.singleTweet(id, {
      "tweet.fields": ["text", "in_reply_to_user_id"]
    });
    const { text, in_reply_to_user_id } = data;

    const repliedToBot = in_reply_to_user_id === TWITTER_BOT_ID;
    const mentionMatch = text.match(new RegExp(`@${TWITTER_BOT_HANDLE}`, "gi"))
      ?.length;

    const isValidQuote = mentionMatch === (repliedToBot ? 2 : 1);

    return isValidQuote;
  } catch (e) {
    logError(e);
  }
};

export const getMentionAndReply = async id => {
  try {
    const tweetInfo = await readWriteClient.v2.singleTweet(id, {
      expansions: ["referenced_tweets.id"]
    });
    const tweetReply = tweetInfo?.includes?.tweets[0];
    if (!tweetReply?.id) throw new Error("No reply tweet was detected.");
    const repliedTweetInfo = await readWriteClient.v2.singleTweet(
      tweetReply.id,
      {
        expansions: [
          "attachments.media_keys",
          "attachments.poll_ids",
          "referenced_tweets.id"
        ],
        "media.fields": ["url"]
      }
    );
    const repliedTweetMedia = repliedTweetInfo?.includes?.media;

    return {
      mention: {
        id: tweetInfo.data.id,
        text: tweetInfo.data.text
      },
      replied: {
        id: repliedTweetInfo.data.id,
        text: repliedTweetInfo.data.text,
        ...(repliedTweetMedia && { media: repliedTweetMedia })
      }
    };
  } catch (e) {
    logError(e);
  }
};

const generateTxtImgToImg = async (prompt, input_url) => {
  const response = await callTextToImageReplicate(prompt, input_url);
  return response[0];
};

const uploadImageAndReply = async (tweet_id, prompt, image_buffer) => {
  const mediaIds = await Promise.all([
    twitterClientV1.v1.uploadMedia(Buffer.from(image_buffer), { type: "png" })
  ]);

  // const replyPrompt = prompt ? ` "${prompt}"` : "";

  const response = await twitterClientV1.v2.reply(
    `#DiffuseReply by AE.studio`,
    tweet_id,
    {
      media: {
        media_ids: mediaIds
      }
    }
  );
  return response;
};

export const workflowDiffuseReply = async id => {
  try {
    const { mention, replied } = await getMentionAndReply(id);
    log("Got related Tweet info.");

    const finalPrompt = prepareFinalPrompt(mention, replied);

    log("Final prompt:", finalPrompt);

    log("Generating Stable Diffusion image from tweet...");
    const generatedImageURL = await generateTxtImgToImg(
      finalPrompt,
      replied.media ? replied.media[0].url : null
    );
    log("Generation sucessful.");

    const generatedImageBuffer = await urlToBuffer(generatedImageURL);

    log("Uploading picture and replying...");
    const postedTweet = await uploadImageAndReply(
      mention.id,
      finalPrompt,
      generatedImageBuffer
    );
    log("Success.");

    return postedTweet;
  } catch (e) {
    logError(e.message);
  }
};

export const startStream = async () => {
  try {
    const stream = twitterClient.v2.searchStream({ autoConnect: false });

    const rules = await readWriteClient.v2.streamRules();
    const rulesIdList = rules?.data?.map(({ id }) => id);

    rulesIdList &&
      (await twitterClient.v2.updateStreamRules({
        delete: {
          ids: rulesIdList
        }
      }));

    await twitterClient.v2.updateStreamRules({
      add: [{ value: TWITTER_STREAM_RULE }]
    });

    stream.on(ETwitterStreamEvent.Data, async ({ data }) => {
      const isValidMention = await getTweetHasMention(data.id);

      if (data.id && isValidMention) {
        log("Received request. Starting...");
        await workflowDiffuseReply(data.id);
        log("Workflow finished.");
      }
    });

    stream.on(ETwitterStreamEvent.Connected, async () => {
      log("Twitter stream started.");
    });

    log("Starting Twitter stream...");
    await stream.connect({
      autoReconnect: true,
      autoReconnectRetries: Infinity
    });

    return stream;
  } catch (e) {
    logError(e?.data || e);
  }
};
