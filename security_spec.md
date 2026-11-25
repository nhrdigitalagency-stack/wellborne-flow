# TASKFLOW — Spécification de Sécurité Firestore (Phase 0 TDD)

## 1. Invariants de Données (Data Invariants)

1. **Isolation PII (`users/{uid}` vs `usersPublic/{uid}`)** : Aucune donnée personnelle identifiable (`email`, préférences privées) n'est lisible par un autre employé. Seul le propriétaire (`request.auth.uid == uid`) ou un administrateur peut lire `users/{uid}`. L'annuaire d'équipe utilise `usersPublic/{uid}` sans PII.
2. **Interdiction d'Auto-Élévation de Privilèges** : Un utilisateur qui s'inscrit reçoit obligatoirement `role == 'employee'` (sauf l'e-mail administrateur initial vérifié `nhrdigitalagency@gmail.com`). Aucun employé ni responsable ne peut modifier son propre champ `role` ou `accountStatus`.
3. **Intégrité d'Identité et d'Immuabilité** : Les champs `createdBy`, `ownerId`, `createdAt` sur `tasks`, `missions`, `missionAssignments` sont strictement immuables après création et validés contre `request.auth.uid` et `request.time`.
4. **Indépendance des Missions Multi-Employés** : Un employé ne peut lire et mettre à jour que ses propres `missionAssignments` (`employeeId == request.auth.uid`). Il ne peut jamais approuver son propre travail (`workStatus == 'approved'`) ni marquer directement une tâche issue de mission (`source == 'mission'`) comme `status == 'completed'`.
5. **Visibilité de l'Espace Commun & Protection des Brouillons** : Les tâches `publicationStatus == 'draft'` sont privées (auteur + responsables/administrateurs). Les tâches `published` sont consultables en lecture seule par les collègues ; seul le propriétaire (ou un responsable/admin) peut les modifier.
6. **Journal d'Audit Immuable** : Les documents `auditLogs` sont strictement append-only (`allow update, delete: if false`).
7. **Verrouillage d'État Terminal** : Une tâche `completed` ou `cancelled`, ou une affectation `approved`, ne peut plus être modifiée par un employé (seul un administrateur peut intervenir en cas de correction exceptionnelle).
8. **Protection Compte Suspendu & E-mail Vérifié** : Toute écriture requiert `request.auth.token.email_verified == true` et un compte actif (`accountStatus == 'active'`).

## 2. Les 12 Payloads Malveillants ("Dirty Dozen") devant recevoir PERMISSION_DENIED

1. **P01 — Auto-promotion Admin à l'inscription** : `CREATE /users/{empUid}` avec `{ role: "admin", accountStatus: "active" }`.
2. **P02 — Élévation de rôle sur profil existant** : `UPDATE /users/{empUid}` avec `{ role: "manager" }`.
3. **P03 — Fuite PII d'un collègue** : `GET /users/{colleagueUid}` par un employé non-propriétaire.
4. **P04 — Shadow Field (Champ Fantôme) sur tâche** : `CREATE /tasks/{id}` incluant un champ non déclaré `{ isApprovedByHack: true }`.
5. **P05 — Usurpation de propriétaire (`ownerId` spoofing)** : `CREATE /tasks/{id}` avec `ownerId != request.auth.uid`.
6. **P06 — Modification de la tâche publiée d'un collègue** : `UPDATE /tasks/{colleagueTaskId}` par un employé tiers.
7. **P07 — Auto-validation d'une tâche de mission** : `UPDATE /tasks/{missionTaskId}` par l'employé propriétaire tentant de passer `status: "completed"`.
8. **P08 — Auto-approbation d'une affectation de mission** : `UPDATE /missionAssignments/{assignId}` par l'employé tentant de passer `workStatus: "approved"`.
9. **P09 — Falsification d'horodatage (`createdAt` non serveur)** : `CREATE /tasks/{id}` avec une date forgée différente de `request.time`.
10. **P10 — Injection d'ID surdimensionné / invalide (ID Poisoning)** : `CREATE /tasks/invalid..id$$$` ou ID > 128 caractères.
11. **P11 — Suppression ou altération d'un log d'audit** : `DELETE /auditLogs/{logId}` ou `UPDATE /auditLogs/{logId}` par un employé ou responsable.
12. **P12 — Accès avec compte suspendu ou e-mail non vérifié** : `CREATE /tasks/{id}` par un utilisateur dont `email_verified == false` ou `accountStatus == 'suspended'`.
