import { ClientProfile, ApprovedLesson, ThresholdSettings } from '../types';
import { DEFAULT_THRESHOLDS } from './calculator';

const STORAGE_KEYS = {
  CLIENTS: 'ads_analyst_clients_v1',
  SELECTED_CLIENT_ID: 'ads_analyst_selected_client_id_v1',
  LESSONS_PREFIX: 'ads_analyst_lessons_',
  THRESHOLDS: 'ads_analyst_thresholds_v1',
};

// Default empty initial state
export const Storage = {
  // Clients
  getClients(): ClientProfile[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CLIENTS);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveClients(clients: ClientProfile[]): void {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  },

  getClient(id: string): ClientProfile | null {
    const clients = this.getClients();
    return clients.find((c) => c.id === id) || null;
  },

  upsertClient(client: ClientProfile): void {
    const clients = this.getClients();
    const index = clients.findIndex((c) => c.id === client.id);
    if (index >= 0) {
      clients[index] = { ...client, updatedAt: new Date().toISOString() };
    } else {
      clients.push({ ...client, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.saveClients(clients);
  },

  deleteClient(id: string): void {
    const clients = this.getClients().filter((c) => c.id !== id);
    this.saveClients(clients);
    // Remove lessons for this client
    localStorage.removeItem(`${STORAGE_KEYS.LESSONS_PREFIX}${id}`);
    if (this.getSelectedClientId() === id) {
      this.setSelectedClientId(clients[0]?.id || null);
    }
  },

  getSelectedClientId(): string | null {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_CLIENT_ID);
  },

  setSelectedClientId(id: string | null): void {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_CLIENT_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.SELECTED_CLIENT_ID);
    }
  },

  // Lessons
  getLessons(clientId: string): ApprovedLesson[] {
    try {
      const data = localStorage.getItem(`${STORAGE_KEYS.LESSONS_PREFIX}${clientId}`);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveLessons(clientId: string, lessons: ApprovedLesson[]): void {
    localStorage.setItem(`${STORAGE_KEYS.LESSONS_PREFIX}${clientId}`, JSON.stringify(lessons));
  },

  addLesson(lesson: Omit<ApprovedLesson, 'id' | 'createdAt'>): ApprovedLesson {
    const newLesson: ApprovedLesson = {
      ...lesson,
      id: `lesson_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    const lessons = this.getLessons(lesson.clientId);
    lessons.unshift(newLesson);
    this.saveLessons(lesson.clientId, lessons);
    return newLesson;
  },

  updateLesson(clientId: string, lessonId: string, updates: Partial<ApprovedLesson>): void {
    const lessons = this.getLessons(clientId);
    const index = lessons.findIndex((l) => l.id === lessonId);
    if (index >= 0) {
      lessons[index] = { ...lessons[index], ...updates };
      this.saveLessons(clientId, lessons);
    }
  },

  deleteLesson(clientId: string, lessonId: string): void {
    const lessons = this.getLessons(clientId).filter((l) => l.id !== lessonId);
    this.saveLessons(clientId, lessons);
  },

  /**
   * Get Valid lessons from the last 5 periods of the same client for AI prompt
   */
  getValidLessonsForAnalysis(clientId: string): ApprovedLesson[] {
    const allLessons = this.getLessons(clientId);
    const validLessons = allLessons.filter((l) => l.status === 'Valid');

    // Group by period/campaign or date to capture last 5 distinct periods
    const periodsSeen = new Set<string>();
    const result: ApprovedLesson[] = [];

    for (const lesson of validLessons) {
      const periodKey = lesson.periodOrCampaign || lesson.date;
      if (!periodsSeen.has(periodKey)) {
        if (periodsSeen.size >= 5) break;
        periodsSeen.add(periodKey);
      }
      result.push(lesson);
    }

    return result;
  },

  // Thresholds
  getThresholds(): ThresholdSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.THRESHOLDS);
      if (!data) return DEFAULT_THRESHOLDS;
      return { ...DEFAULT_THRESHOLDS, ...JSON.parse(data) };
    } catch {
      return DEFAULT_THRESHOLDS;
    }
  },

  saveThresholds(thresholds: ThresholdSettings): void {
    localStorage.setItem(STORAGE_KEYS.THRESHOLDS, JSON.stringify(thresholds));
  },

  // Backup Export / Import
  exportBackup(): string {
    const clients = this.getClients();
    const allLessons: Record<string, ApprovedLesson[]> = {};
    for (const client of clients) {
      allLessons[client.id] = this.getLessons(client.id);
    }

    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      clients,
      lessons: allLessons,
      thresholds: this.getThresholds(),
    };

    return JSON.stringify(backup, null, 2);
  },

  importBackup(jsonString: string): { success: boolean; clientCount: number; lessonCount: number; error?: string } {
    try {
      const data = JSON.parse(jsonString);
      if (!data.clients || !Array.isArray(data.clients)) {
        return { success: false, clientCount: 0, lessonCount: 0, error: 'Invalid backup format: missing clients array' };
      }

      this.saveClients(data.clients);
      let lessonCount = 0;
      if (data.lessons && typeof data.lessons === 'object') {
        for (const [clientId, lessons] of Object.entries(data.lessons)) {
          if (Array.isArray(lessons)) {
            this.saveLessons(clientId, lessons as ApprovedLesson[]);
            lessonCount += lessons.length;
          }
        }
      }

      if (data.thresholds) {
        this.saveThresholds(data.thresholds);
      }

      return { success: true, clientCount: data.clients.length, lessonCount };
    } catch (err: any) {
      return { success: false, clientCount: 0, lessonCount: 0, error: err.message || 'Failed to parse JSON file' };
    }
  },
};
