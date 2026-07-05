import { api } from "./client";

export async function sendChatMessage(message: string, sessionId?: string) {
  return api.post("/agent/chat", { message, session_id: sessionId });
}

export async function submitQuestion(questionId: string, answers: Record<string, unknown>, skipped = false) {
  return api.post("/agent/question", { question_id: questionId, answers, skipped });
}
