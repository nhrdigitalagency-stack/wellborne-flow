import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
  details?: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let message = 'Une erreur inattendue est survenue.';
    let details = error.message;

    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error) {
        if (parsed.error.toLowerCase().includes('permission')) {
          message = 'Accès refusé par les règles de sécurité Firestore.';
        } else if (parsed.error.toLowerCase().includes('quota')) {
          message = 'Quota Firestore dépassé. Veuillez réessayer ultérieurement.';
        } else {
          message = `Erreur lors de l’opération (${parsed.operationType || 'base de données'}).`;
        }
        details = `${parsed.path ? `Chemin : ${parsed.path} — ` : ''}${parsed.error}`;
      }
    } catch {
      // Message brut non JSON
    }

    return { hasError: true, message, details };
  }

  componentDidCatch(error: Error) {
    console.error('WELLBORNE FLOW ErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4F6FA] dark:bg-[#0B1320] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-xl p-8">
            <div className="flex items-center gap-3 text-[#DC4545] dark:text-red-400 mb-4">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-bold text-[#172D4D] dark:text-slate-100">
                Incident détecté sur WELLBORNE FLOW
              </h1>
            </div>
            <p className="text-sm text-[#172D4D] dark:text-slate-200 font-medium mb-2">
              {this.state.message}
            </p>
            {this.state.details && (
              <p className="text-xs text-[#667085] dark:text-slate-400 bg-[#F4F6FA] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-lg p-3 mb-6 break-words font-mono-num">
                {this.state.details}
              </p>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#172D4D] dark:bg-[#3578C8] text-white text-sm font-medium rounded-lg hover:bg-[#1e3a63] dark:hover:bg-[#2a63a8] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Recharger l’application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
