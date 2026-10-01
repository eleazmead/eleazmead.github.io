import { RsvpSubmission } from '../models/guest.model';

export function buildEventString(submission: RsvpSubmission): string {
  const date = submission.rsvpSubmittedAt.split('T')[0];
  const mealLabel = (m?: string) => (m === 'beef' ? 'Beef' : m === 'fish' ? 'Fish' : '');

  const accepted = submission.entries
    .filter((e) => e.RSVP)
    .map((e) => `${e.Guest}${e.MealChoice ? ` (${mealLabel(e.MealChoice)})` : ''}`)
    .join(', ');
  const declined = submission.entries
    .filter((e) => !e.RSVP)
    .map((e) => e.Guest)
    .join(', ');

  const parts: string[] = [];
  if (accepted) parts.push(`attending: ${accepted}`);
  if (declined) parts.push(`not attending: ${declined}`);
  return `${submission.initiatorFullName} responded on ${date} - ${parts.join('; ')}. Group total: ${submission.rsvpTotal} attending (${submission.rsvpBeefCount} beef, ${submission.rsvpFishCount} fish).`;
}
