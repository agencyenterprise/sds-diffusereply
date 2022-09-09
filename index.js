import * as dotenv from "dotenv";
dotenv.config();

import express, { json } from "express";

import { startStream } from "./src/twitter.js";
import { log } from "./src/util.js";

const { PORT } = process.env;

const app = express();
app.use(json({}));

app.listen(PORT, async () => {
  try {
    const twitterStream = await startStream();

    const onProcessExit = async () =>
      twitterStream.close && twitterStream.close();

    process.on("uncaughtException", onProcessExit);
    process.on("SIGINT", onProcessExit);

    log(`Bot running on port ${PORT}.`);
  } catch (e) {
    console.error(e);
    e.data && console.log(e.data);
  }
});
