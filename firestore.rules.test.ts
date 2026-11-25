/**
 * TASKFLOW — Suite de tests des règles de sécurité Firestore (Phase 0 TDD)
 * Vérifie les 12 payloads malveillants ("Dirty Dozen") ainsi que les scénarios autorisés
 * pour Employé, Responsable et Administrateur.
 *
 * Exécution avec Firebase Emulator Suite :
 *   firebase emulators:exec "npx tsx firestore.rules.test.ts"
 */

export interface SecurityTestCase {
  id: string;
  name: string;
  actor: 'employee' | 'employee_b' | 'manager' | 'admin' | 'unverified' | 'suspended';
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'ALLOW' | 'PERMISSION_DENIED';
  pillar: string;
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 'P01',
    name: 'Auto-promotion Administrateur lors de l’inscription',
    actor: 'employee',
    operation: 'create',
    path: '/users/emp_001',
    payload: { uid: 'emp_001', role: 'admin', accountStatus: 'active' },
    expected: 'PERMISSION_DENIED',
    pillar: 'Tiered Identity & Anti-Escalation',
  },
  {
    id: 'P02',
    name: 'Élévation de rôle par un employé sur son propre profil',
    actor: 'employee',
    operation: 'update',
    path: '/users/emp_001',
    payload: { role: 'manager' },
    expected: 'PERMISSION_DENIED',
    pillar: 'Action-Based Update & Role Protection',
  },
  {
    id: 'P03',
    name: 'Lecture PII (e-mail) d’un collègue dans /users/{uid}',
    actor: 'employee',
    operation: 'get',
    path: '/users/emp_002',
    expected: 'PERMISSION_DENIED',
    pillar: 'Pillar 6: PII Isolation',
  },
  {
    id: 'P04',
    name: 'Shadow Field (champ non déclaré) à la création d’une tâche',
    actor: 'employee',
    operation: 'create',
    path: '/tasks/task_shadow_1',
    payload: { title: 'Test', isApprovedByHack: true },
    expected: 'PERMISSION_DENIED',
    pillar: 'Pillar 2: Strict Keys (hasOnly)',
  },
  {
    id: 'P05',
    name: 'Usurpation de propriétaire (ownerId != auth.uid)',
    actor: 'employee',
    operation: 'create',
    path: '/tasks/task_spoof_1',
    payload: { ownerId: 'emp_002', createdBy: 'emp_001' },
    expected: 'PERMISSION_DENIED',
    pillar: 'Pillar 2: Identity Integrity',
  },
  {
    id: 'P06',
    name: 'Modification de la tâche publiée d’un collègue',
    actor: 'employee_b',
    operation: 'update',
    path: '/tasks/task_emp_001_pub',
    payload: { title: 'Titre modifié par un collègue' },
    expected: 'PERMISSION_DENIED',
    pillar: 'Pillar 4: Ownership Isolation',
  },
  {
    id: 'P07',
    name: 'Auto-clôture (completed) d’une tâche issue de mission par l’employé',
    actor: 'employee',
    operation: 'update',
    path: '/tasks/mission_m1_emp_001',
    payload: { status: 'completed', progress: 100 },
    expected: 'PERMISSION_DENIED',
    pillar: 'Mission Validation Enforcement',
  },
  {
    id: 'P08',
    name: 'Auto-approbation d’une affectation de mission par l’employé',
    actor: 'employee',
    operation: 'update',
    path: '/missionAssignments/m1_emp_001',
    payload: { workStatus: 'approved' },
    expected: 'PERMISSION_DENIED',
    pillar: 'Mission Approval Protection',
  },
  {
    id: 'P09',
    name: 'Falsification d’horodatage serveur (createdAt != request.time)',
    actor: 'employee',
    operation: 'create',
    path: '/tasks/task_fake_time',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
    pillar: 'Temporal Integrity',
  },
  {
    id: 'P10',
    name: 'Injection d’ID invalide (caractères interdits / ID poisoning)',
    actor: 'employee',
    operation: 'create',
    path: '/tasks/bad..id$$$',
    payload: { title: 'Poison' },
    expected: 'PERMISSION_DENIED',
    pillar: 'Pillar 3: Path Variable Hardening',
  },
  {
    id: 'P11',
    name: 'Suppression d’une entrée du journal d’audit par un employé',
    actor: 'employee',
    operation: 'delete',
    path: '/auditLogs/log_001',
    expected: 'PERMISSION_DENIED',
    pillar: 'Immutable Audit Trail',
  },
  {
    id: 'P12',
    name: 'Écriture par un compte suspendu ou à e-mail non vérifié',
    actor: 'suspended',
    operation: 'create',
    path: '/tasks/task_suspended',
    payload: { title: 'Tentative suspendue' },
    expected: 'PERMISSION_DENIED',
    pillar: 'Active Verified Account Enforcement',
  },
];

export const POSITIVE_ACCESS_TESTS: SecurityTestCase[] = [
  {
    id: 'A01',
    name: 'Employé consulte une tâche publiée dans l’espace commun',
    actor: 'employee_b',
    operation: 'get',
    path: '/tasks/task_emp_001_pub',
    expected: 'ALLOW',
    pillar: 'Shared Workspace Read',
  },
  {
    id: 'A02',
    name: 'Employé accepte sa mission et crée atomiquement sa tâche liée',
    actor: 'employee',
    operation: 'update',
    path: '/missionAssignments/m1_emp_001',
    payload: { acceptanceStatus: 'accepted', workStatus: 'in_progress', taskId: 'mission_m1_emp_001' },
    expected: 'ALLOW',
    pillar: 'Pillar 7: Atomicity (existsAfter)',
  },
  {
    id: 'A03',
    name: 'Responsable approuve une soumission de mission',
    actor: 'manager',
    operation: 'update',
    path: '/missionAssignments/m1_emp_001',
    payload: { workStatus: 'approved', progress: 100 },
    expected: 'ALLOW',
    pillar: 'Manager Approval Flow',
  },
  {
    id: 'A04',
    name: 'Administrateur modifie le rôle et le statut d’un compte',
    actor: 'admin',
    operation: 'update',
    path: '/users/emp_001',
    payload: { role: 'manager', accountStatus: 'active' },
    expected: 'ALLOW',
    pillar: 'Admin RBAC Management',
  },
];
