import subjectsJson from '../../content/subjects.json';
import bullitsJson from '../../content/bullits.json';
import trainingJson from '../../content/training.json';
import type { Bullit, Question, Subject } from './types';

export const subjects = subjectsJson as Subject[];
export const bullits = bullitsJson as Bullit[];
export const training = trainingJson as Question[];

const files = import.meta.glob<Question[]>('/content/questions/*/*.json', {
  eager: true,
  import: 'default',
});

export const questionsByTopic = new Map<string, Question[]>();
export const questionsById = new Map<string, Question>();

for (const list of Object.values(files)) {
  for (const q of list) {
    const bucket = questionsByTopic.get(q.topicId) ?? [];
    bucket.push(q);
    questionsByTopic.set(q.topicId, bucket);
    questionsById.set(q.id, q);
  }
}
