import OpenAI from "openai";

const apiKey = process.env["OPENAI_API_KEY"];

export const openai = new OpenAI({
  apiKey: apiKey ?? "sk-placeholder",
});

export const isOpenAIConfigured = Boolean(apiKey);
