export interface LessonPlan {
  id: string;
  title: string;
  description: string;
  skillLevel: number;
  objectives: string[];
  activities: string[];
  duration: string;
  vocabulary: string[];
  grammar?: string[];
}
