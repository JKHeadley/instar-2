export function exhaustedPollReason(failedPolls, conflictedPolls) {
  if (conflictedPolls >= 5) return 'Telegram polling conflict after 5 attempts';
  if (failedPolls >= 20) return 'Telegram polling failed 20 times in a row';
  return null;
}
