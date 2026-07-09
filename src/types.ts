export type FeedbackType = 'bug' | 'feature' | 'improvement' | 'performance' | 'general';

export type BugReport = {
  title: string;
  screen: string;
  description: string;
  device: string;
  expectedResult: string;
  actualResult: string;
  stepsToReproduce: string;
  androidVersion?: string;
  appVersion?: string;
};

export type FeatureSuggestion = {
  title: string;
  description: string;
  whyNeeded: string;
  benefit: string;
  priority: 'High' | 'Medium' | 'Low' | '';
  category: string;
};

export type UiImprovement = {
  screen: string;
  suggestion: string;
};

export type PerformanceFeedback = {
  appSpeed: number;
  easeOfUse: number;
  design: number;
  features: number;
  overallExperience: number;
  selectedIssues: string[];
};

export type ContactInfo = {
  name: string;
  email: string;
  phone?: string;
};

export type DeviceInfo = {
  browser: string;
  operatingSystem: string;
  internetStatus: string;
  screenResolution: string;
  timestamp: string;
  currentUrl: string;
};

export type AdminInfo = {
  status: 'Open' | 'In Progress' | 'Fixed' | 'Closed';
  assignedDeveloper?: string;
  internalNotes?: string;
  updatedAt?: string;
};

export interface FeedbackItem {
  id: number;
  type: FeedbackType;
  createdAt: string;
  updatedAt: string;
  bugReport?: BugReport;
  featureSuggestion?: FeatureSuggestion;
  uiImprovement?: UiImprovement;
  performance?: PerformanceFeedback;
  generalFeedback?: string;
  contact: ContactInfo;
  deviceInfo: DeviceInfo;
  admin: AdminInfo;
  attachments?: { base64: string; name: string; type: string }[];
  wantsToSuggestFeature?: 'yes' | 'no';
  // For migration of old flat structure
  title?: string;
  description?: string;
  priority?: 'High' | 'Medium' | 'Low';
  category?: string;
  device?: string;
  name?: string;
  email?: string;
  phone?: string;
  meta?: any;
  status?: 'Open' | 'In Progress' | 'Fixed' | 'Closed';
  internalNotes?: string;
  imageBase64s?: string[];
}