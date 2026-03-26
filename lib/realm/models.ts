import { IMongoDocument } from "./MongoService";

// Example data model interfaces
export interface IUserProfile extends IMongoDocument {
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
  };
}

export interface IHackathon extends IMongoDocument {
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  prizePool: number;
  tags: string[];
  skills: string[];
  matchScore?: number;
  urgencyScore?: number;
  valueScore?: number;
  priority?: number;
}

export interface IUserAchievement extends IMongoDocument {
  userId: string;
  title: string;
  description: string;
  earnedAt: Date;
  imageUrl?: string;
  skillsDemonstrated: string[];
}

export interface ISkillDemand extends IMongoDocument {
  skill: string;
  frequency: number;
  trend: 'rising' | 'stable' | 'declining';
  lastUpdated: Date;
}