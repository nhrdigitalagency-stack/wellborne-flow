import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';

// Initialisation Firebase Admin (Cloud Functions v2)
const app = initializeApp();

// Base Firestore nommée utilisée par WELLBORNE FLOW (modifiable via variable d'environnement)
export const DATABASE_ID =
  process.env.FIREBASE_DATABASE_ID || 'ai-studio-6eb74840-4518-4948-afa0-24ce5378f486';

export const db = getFirestore(app, DATABASE_ID);

setGlobalOptions({
  region: 'europe-west1',
  maxInstances: 10,
});

export { sendDailyEveningReminders } from './reminders/dailyReminder';
export { generateWeeklyReports } from './reports/weeklyReport';
export {
  onMissionAssignmentCreated,
  onMissionAssignmentUpdated,
} from './missions/missionTriggers';
