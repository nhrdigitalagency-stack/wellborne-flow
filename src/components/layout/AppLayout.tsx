import React, { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Briefcase,
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FilePlus2,
  FolderKanban,
  Globe,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  Shield,
  Sun,
  Target,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { logoutUser } from '../../services/auth/authService';
import { ROLE_LABELS } from '../../utils/taskUtils';
import { UserAvatar } from '../ui/Primitives';
import { GlobalSearchBar } from './GlobalSearchBar';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const ROUTE_TITLES: Record<string, string> = {
  '/tableau-de-bord': 'Tableau de bord',
  '/mes-taches': 'Mes tâches',
  '/taches/nouvelle': 'Créer une tâche',
  '/espace-commun': 'Espace commun',
  '/mes-missions': 'Mes missions',
  '/planning': 'Planning personnel',
  '/notifications': 'Centre de notifications',
  '/mes-rapports': 'Mes rapports',
  '/profil': 'Mon profil',
  '/parametres': 'Paramètres',
  '/responsable': 'Vue générale responsable',
  '/toutes-les-taches': 'Toutes les tâches',
  '/missions/nouvelle': 'Créer une mission',
  '/toutes-les-missions': 'Toutes les missions',
  '/employes': 'Collaborateurs',
  '/planning-equipe': 'Planning équipe',
  '/validations': 'Validations des travaux',
  '/rapports': 'Rapports individuels et collectifs',
  '/historique': 'Historique d’activité',
  '/admin': 'Administration générale',
  '/admin/utilisateurs': 'Gestion des utilisateurs et rôles',
  '/admin/parametres': 'Paramètres de l’entreprise',
  '/admin/securite': 'Journaux de sécurité',
};

export function AppLayout() {
  const { profile, orgSettings } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { unreadCount, managedAssignments, myAssignments } = useWorkspace();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const pendingValidationsCount = useMemo(
    () => managedAssignments.filter((a) => a.workStatus === 'submitted').length,
    [managedAssignments]
  );

  const pendingMyMissionsCount = useMemo(
    () => myAssignments.filter((a) => a.acceptanceStatus === 'pending').length,
    [myAssignments]
  );

  const role = profile?.role || 'employee';

  const navSections = useMemo(() => {
    const employeeItems: NavItem[] = [
      { to: '/tableau-de-bord', label: 'Tableau de bord', icon: LayoutDashboard },
      { to: '/mes-taches', label: 'Mes tâches', icon: CheckSquare },
      { to: '/taches/nouvelle', label: 'Créer une tâche', icon: FilePlus2 },
      { to: '/espace-commun', label: 'Espace commun', icon: Globe },
      { to: '/mes-missions', label: 'Mes missions', icon: Target, badge: pendingMyMissionsCount },
      { to: '/planning', label: 'Planning', icon: Calendar },
      { to: '/notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
      { to: '/mes-rapports', label: 'Mes rapports', icon: BarChart3 },
    ];

    const managerItems: NavItem[] = [
      { to: '/responsable', label: 'Vue générale', icon: Briefcase },
      { to: '/toutes-les-taches', label: 'Toutes les tâches', icon: FolderKanban },
      { to: '/missions/nouvelle', label: 'Créer une mission', icon: Plus },
      { to: '/toutes-les-missions', label: 'Toutes les missions', icon: Target },
      { to: '/validations', label: 'Validations', icon: ClipboardCheck, badge: pendingValidationsCount },
      { to: '/employes', label: 'Employés', icon: Users },
      { to: '/planning-equipe', label: 'Planning équipe', icon: Calendar },
      { to: '/rapports', label: 'Rapports', icon: BarChart3 },
      { to: '/historique', label: 'Historique', icon: History },
    ];

    const adminItems: NavItem[] = [
      { to: '/admin', label: 'Administration', icon: Shield },
      { to: '/admin/utilisateurs', label: 'Utilisateurs & Rôles', icon: Users },
      { to: '/admin/parametres', label: 'Paramètres généraux', icon: Settings },
      { to: '/admin/securite', label: 'Journaux de sécurité', icon: History },
    ];

    const accountItems: NavItem[] = [
      { to: '/profil', label: 'Mon profil', icon: UserCircle },
      { to: '/parametres', label: 'Préférences', icon: Settings },
    ];

    if (role === 'admin') {
      return [
        { title: 'Administration', items: adminItems },
        { title: 'Supervision', items: managerItems },
        { title: 'Mon espace', items: employeeItems },
        { title: 'Compte', items: accountItems },
      ];
    }

    if (role === 'manager') {
      return [
        { title: 'Supervision', items: managerItems },
        { title: 'Mon espace', items: employeeItems },
        { title: 'Compte', items: accountItems },
      ];
    }

    return [
      { title: 'Espace de travail', items: employeeItems },
      { title: 'Compte', items: accountItems },
    ];
  }, [role, unreadCount, pendingValidationsCount, pendingMyMissionsCount]);

  const currentPageTitle = useMemo(() => {
    if (ROUTE_TITLES[location.pathname]) return ROUTE_TITLES[location.pathname];
    if (location.pathname.startsWith('/taches/')) return 'Détail de la tâche';
    if (location.pathname.startsWith('/missions/')) return 'Détail de la mission';
    return 'WELLBORNE FLOW';
  }, [location.pathname]);

  const handleLogout = async () => {
    await logoutUser();
    navigate('/connexion');
  };

  const renderNavLinks = (isMobile = false) => (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Navigation principale">
      {navSections.map((section) => (
        <div key={section.title}>
          {(!collapsed || isMobile) && (
            <p className="px-3 mb-2 text-[11px] font-semibold tracking-wide text-slate-400">
              {section.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => isMobile && setMobileOpen(false)}
                    title={collapsed && !isMobile ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-[#3578C8] text-white'
                          : 'text-slate-200 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {(!collapsed || isMobile) && (
                      <span className="truncate flex-1">{item.label}</span>
                    )}
                    {(!collapsed || isMobile) && item.badge !== undefined && item.badge > 0 && (
                      <span className="text-xs font-mono-num font-semibold px-1.5 py-0.5 rounded bg-white/15 text-white">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F4F6FA] dark:bg-[#0B1320] flex overflow-x-clip">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-[#172D4D] dark:bg-[#0E1829] text-white shrink-0 sticky top-0 h-screen border-r border-transparent dark:border-slate-800 transition-[width] duration-200 no-print ${
          collapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-white/10">
          <Link
            to={role === 'admin' ? '/admin' : role === 'manager' ? '/responsable' : '/tableau-de-bord'}
            className="flex items-center gap-2.5 min-w-0"
          >
            <div className="w-8 h-8 rounded-lg bg-[#3578C8] flex items-center justify-center font-display font-bold text-xs shrink-0">
              WF
            </div>
            {!collapsed && (
              <span className="font-display font-bold text-sm tracking-tight truncate">
                WELLBORNE FLOW
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Déplier la navigation' : 'Réduire la navigation'}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {renderNavLinks(false)}

        <div className="p-3 border-t border-white/10">
          <div className={`flex items-center gap-3 px-2 py-2 ${collapsed ? 'justify-center' : ''}`}>
            <UserAvatar
              firstName={profile?.firstName}
              lastName={profile?.lastName}
              photoURL={profile?.photoURL}
              size="sm"
            />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">
                  {profile?.firstName} {profile?.lastName}
                </p>
                <p className="text-[11px] text-slate-300 truncate">
                  {ROLE_LABELS[role]}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
                onClick={handleLogout}
                title="Se déconnecter"
                aria-label="Se déconnecter"
                className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#172D4D]/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[280px] max-w-[85vw] bg-[#172D4D] dark:bg-[#0E1829] text-white flex flex-col h-full">
            <div className="h-16 px-4 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#3578C8] flex items-center justify-center font-display font-bold text-xs">
                  WF
                </div>
                <span className="font-display font-bold text-sm tracking-tight">WELLBORNE FLOW</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Fermer le menu"
                className="p-2 text-slate-300 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderNavLinks(true)}
            <div className="p-4 border-t border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <UserAvatar
                  firstName={profile?.firstName}
                  lastName={profile?.lastName}
                  photoURL={profile?.photoURL}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">
                    {profile?.firstName} {profile?.lastName}
                  </p>
                  <p className="text-[11px] text-slate-300 truncate">{ROLE_LABELS[role]}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 text-slate-300 hover:text-white rounded-lg cursor-pointer"
                aria-label="Se déconnecter"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-[#111C2E] border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-3 sm:gap-5 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 min-w-0 shrink">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir la navigation"
              className="lg:hidden p-2 -ml-2 text-[#172D4D] dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#667085] dark:text-slate-400">
                <span className="hidden xl:inline truncate">{orgSettings.companyName}</span>
                <span className="hidden xl:inline" aria-hidden="true">/</span>
                <span className="text-sm sm:text-base font-bold font-display text-[#172D4D] dark:text-slate-100 truncate">
                  {currentPageTitle}
                </span>
              </div>
            </div>
          </div>

          <GlobalSearchBar />

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
              title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
              className="p-2 text-[#667085] dark:text-slate-300 hover:text-[#172D4D] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <Link
              to="/notifications"
              aria-label="Notifications"
              className="relative p-2 text-[#667085] dark:text-slate-300 hover:text-[#172D4D] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#DC4545] text-white text-[10px] font-mono-num font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>

            <Link
              to={role === 'manager' || role === 'admin' ? '/missions/nouvelle' : '/taches/nouvelle'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#3578C8] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#2a63a8] transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">
                {role === 'manager' || role === 'admin' ? 'Nouvelle mission' : 'Nouvelle tâche'}
              </span>
              <span className="sm:hidden">Créer</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
