export type SubjectId = 'math' | 'russian' | 'history';
export type Level = 1 | 2 | 3;
export interface Topic { id: string; title: string; paragraphs: string; released: boolean }   // id вида 'math-03'
export interface Subject { id: SubjectId; title: string; book: string; topics: Topic[] }
export interface Question { id: string; subject: SubjectId; topicId: string; level: Level;
  text: string; options: [string, string, string, string]; answer: 0 | 1 | 2 | 3; why: string }  // id вида 'math-03-2-017'
export interface Bullit { id: string; category: 'logic' | 'subject' | 'life' | 'hockey';
  text: string; options: [string, string, string, string]; answer: 0 | 1 | 2 | 3; why: string }
