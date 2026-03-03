import { useStudyTimer } from "@/hooks/useStudyTimer";

export function StudyTimerProvider() {
  useStudyTimer();
  return null;
}
