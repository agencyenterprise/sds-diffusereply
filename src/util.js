import fetch from "node-fetch";

export const urlToBuffer = async url => {
  const response = await fetch(url);
  const responseBuffer = await response.buffer();
  return responseBuffer;
};

export const prepareFinalPrompt = (mentioned, replied) => {
  const mentionPrompt = filterQuoteFromText(
    purgeHttpLinksFromTweet(mentioned.text)
  );
  const repliedText = purgeHttpLinksFromTweet(replied.text);

  return replied.media ? mentionPrompt : `${repliedText} ${mentionPrompt}`;
};

const purgeHttpLinksFromTweet = text =>
  text.replace(/(?:https?|ftp):\/\/[\n\S]+/g, "");

const filterQuoteFromText = text => {
  const str = new RegExp(
    /(?<=((?<=[\s,.:;"']|^)["']))(?:(?=(\\?))\2.)*?(?=\1)/
  ).exec(text);
  return str ? str[0] : "";
};

export const log = (...args) => {
  console.log("=================");
  console.log("LOG:", ...args);
};
