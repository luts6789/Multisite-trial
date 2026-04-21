// @ts-nocheck
import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl border border-zinc-200 text-center"
          >
            <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-rose-600" size={40} />
            </div>
            <h2 className="text-2xl font-black text-zinc-900 mb-4">Something went wrong</h2>
            <p className="text-zinc-500 mb-8 leading-relaxed">
              An unexpected error occurred. This might be due to a connection issue or a temporary glitch.
            </p>
            
            <div className="p-4 bg-zinc-50 rounded-2xl text-xs text-zinc-400 font-mono mb-8 text-left overflow-auto max-h-32">
              {this.state.error?.message}
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <RefreshCcw size={20} /> Reload Application
            </button>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
