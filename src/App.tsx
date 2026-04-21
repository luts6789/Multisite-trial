import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, deleteDoc, query, where, collection, updateDoc, getDocs, addDoc, Timestamp, getDocFromServer } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from './types';
import { Auth } from './components/Auth';
import { AdminDashboard } from './components/AdminDashboard';
import { PersonnelDashboard } from './components/PersonnelDashboard';
import { Inventory } from './components/Inventory';
import { Shops } from './components/Shops';
import { Users } from './components/Users';
import { StockReport } from './components/StockReport';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Messages } from './components/Messages';
import { LayoutDashboard, Package, Users as UsersIcon, Pill, Activity, ShieldAlert, FileText, WifiOff, ShoppingCart, Store, MessageSquare, RefreshCw, Trash2, Lock, Unlock, Key, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We don't always want to throw if it's a background listener, 
  // but for explicit actions we might.
  return errInfo;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'users' | 'report' | 'pos' | 'shops' | 'messages' | 'settings'>('dashboard');
  const [selectedShopIdForPOS, setSelectedShopIdForPOS] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [accessPassword, setAccessPassword] = useState('1234');
  const [unlockedTabs, setUnlockedTabs] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('unlockedTabs');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    sessionStorage.setItem('unlockedTabs', JSON.stringify(unlockedTabs));
  }, [unlockedTabs]);

  useEffect(() => {
    if (!user) return;
    
    const unsub = onSnapshot(doc(db, 'settings', 'access_password'), (snapshot) => {
      if (snapshot.exists()) {
        setAccessPassword(snapshot.data().value);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/access_password');
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Migration removed to prevent recreating shops that the user wants to delete.
  
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Test Firestore connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'system', 'ping'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          setIsOffline(true);
        }
      }
    };
    testConnection();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const clearCache = () => {
    if (window.confirm('This will reload the application and clear local state. Continue?')) {
      window.location.reload();
    }
  };

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAccessDenied(false);
      
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (firebaseUser) {
        // Listen to profile changes in real-time
        unsubProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snapshot) => {
          const data = snapshot.data() as UserProfile | undefined;
          
          // If profile exists and has a role, use it
          if (snapshot.exists() && data?.role) {
            // Force primary admin role
            const isPrimaryAdmin = firebaseUser.email?.toLowerCase() === 'thevalleyviewdrugshop@gmail.com' || firebaseUser.email?.toLowerCase() === 'luts789@gmail.com';
            if (isPrimaryAdmin && data.role !== 'admin') {
              console.log('[Auth Debug] Forcing admin role for primary admin');
              try {
                await updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'admin' });
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
              }
            }
            
            const role = isPrimaryAdmin ? 'admin' : data.role;
            
            if (role === 'admin' && !isPrimaryAdmin) {
              console.warn(`[Security Alert] User ${firebaseUser.email} has admin role assigned in database.`);
            }

            setUserProfile({ id: snapshot.id, ...data, role });
            setLoading(false);
          } else {
            // Check for pre-provisioned profile by email
            const emailId = firebaseUser.email?.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
            console.log('[Auth Debug] Checking pre-provisioned profile:', emailId);
            
            if (emailId) {
              try {
                const emailDoc = await getDoc(doc(db, 'users', emailId));
                if (emailDoc.exists()) {
                  console.log('[Auth Debug] Found pre-provisioned profile, claiming...');
                  const existingData = emailDoc.data();
                  
                  // Create the new UID-based doc FIRST to avoid access denied
                  const claimedProfile: UserProfile = {
                    ...existingData,
                    id: firebaseUser.uid,
                    email: firebaseUser.email?.toLowerCase() || '',
                  } as UserProfile;
                  
                  await setDoc(doc(db, 'users', firebaseUser.uid), claimedProfile);
                  
                  // Then delete the old email-slugged doc
                  try {
                    await deleteDoc(doc(db, 'users', emailId));
                  } catch (deleteErr) {
                    console.warn('[Auth Debug] Could not delete old profile doc, but new one is created:', deleteErr);
                  }
                  
                  console.log('[Auth Debug] Profile claimed successfully');
                  // The snapshot listener will trigger again with the new data
                  return;
                }
              } catch (err) {
                console.error('[Auth Debug] Error claiming profile:', err);
              }
            }

            // If no profile (or no role) and is primary admin, create it
            const isPrimaryAdmin = firebaseUser.email?.toLowerCase() === 'thevalleyviewdrugshop@gmail.com' || firebaseUser.email?.toLowerCase() === 'luts789@gmail.com';
            if (isPrimaryAdmin) {
              console.log('[Auth Debug] Creating initial admin profile');
              const newProfile: UserProfile = {
                id: firebaseUser.uid,
                email: firebaseUser.email?.toLowerCase() || '',
                role: 'admin',
              };
              try {
                await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
              } catch (err) {
                handleFirestoreError(err, OperationType.CREATE, `users/${firebaseUser.uid}`);
              }
            } else if (snapshot.exists()) {
              console.log('[Auth Debug] Profile exists but no role assigned');
              setUserProfile({ id: snapshot.id, ...data } as UserProfile);
              setAccessDenied(true);
              setLoading(false);
            } else {
              console.log('[Auth Debug] No profile found, access denied');
              setUserProfile(null);
              setAccessDenied(true);
              setLoading(false);
            }
          }
        }, (error) => {
          console.error("[Auth Debug] Profile listener error:", error);
          setLoading(false);
        });
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      const q = query(collection(db, 'orders'), where('status', '==', 'pending'));
      const unsub = onSnapshot(q, (snapshot) => {
        setPendingOrdersCount(snapshot.size);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      });
      return () => unsub();
    }
  }, [userProfile?.role]);

  useEffect(() => {
    if (userProfile) {
      const q = query(
        collection(db, 'messages'),
        where('receiverId', '==', userProfile.role === 'admin' ? 'admin' : userProfile.id),
        where('read', '==', false)
      );
      const unsub = onSnapshot(q, (snapshot) => {
        setUnreadMessagesCount(snapshot.size);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'messages');
      });
      return () => unsub();
    }
  }, [userProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-500 font-medium animate-pulse">Initializing PharmaTrack...</p>
        </div>
      </div>
    );
  }

  if (!user || accessDenied) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl border border-zinc-100 text-center"
        >
          <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg rotate-3">
            <Pill className="text-white" size={40} />
          </div>
          <h1 className="text-4xl font-black text-zinc-900 mb-4 tracking-tight">PharmaTrack</h1>
          
          {accessDenied ? (
            <div className="space-y-6">
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-rose-900 mb-1">Access Denied</h2>
                <p className="text-sm text-rose-700 leading-relaxed">
                  Your account is not authorized to access this system. Please contact the administrator to request access.
                </p>
              </div>
              <button 
                onClick={() => auth.signOut()}
                className="w-full py-4 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <>
              <p className="text-zinc-500 mb-10 leading-relaxed">
                A professional multi-site management system for your drug shop operations.
              </p>
              <Auth user={user} loading={loading} />
              
              <div className="mt-8 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 text-left">
                <p className="text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Mobile App Setup</p>
                <p className="text-sm text-zinc-600 leading-snug">
                  To use this as an app: Open in your browser, tap the <strong>Share</strong> or <strong>Menu</strong> icon, and select <strong>"Add to Home Screen"</strong>.
                </p>
              </div>
            </>
          )}

          <div className="mt-10 pt-8 border-t border-zinc-100 flex items-center justify-center gap-6 grayscale opacity-50">
            <Activity size={20} />
            <ShieldAlert size={20} />
            <Package size={20} />
          </div>
        </motion.div>
      </div>
    );
  }

  const isAdmin = userProfile?.role === 'admin';

  return (
    <ErrorBoundary>
      <div className={`min-h-screen bg-zinc-50 flex ${isMobile ? 'flex-col pb-20' : 'flex-row'}`}>
      {/* Mobile Header */}
      {isMobile && (
        <header className="bg-white border-b border-zinc-200 p-4 sticky top-0 z-40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center shadow-md">
              <Pill className="text-white" size={16} />
            </div>
            <span className="text-lg font-black text-zinc-900 tracking-tight">PharmaTrack</span>
          </div>
          <div className="flex items-center gap-2">
            {isOffline && (
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-bold">
                <WifiOff size={10} />
                Offline
              </div>
            )}
            <button 
              onClick={() => setUnlockedTabs([])}
              className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
              title="Lock All Windows"
            >
              <Lock size={18} />
            </button>
          </div>
        </header>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="w-72 bg-white border-r border-zinc-200 p-6 flex flex-col gap-8 sticky top-0 h-screen overflow-y-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-md">
              <Pill className="text-white" size={20} />
            </div>
            <span className="text-xl font-black text-zinc-900 tracking-tight">PharmaTrack</span>
          </div>

          <nav className="flex flex-col gap-2 flex-1">
            {isOffline && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold mb-2">
                <WifiOff size={14} />
                Offline Mode Active
              </div>
            )}
            <SidebarLink 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
              icon={isAdmin ? <LayoutDashboard size={24} /> : <ShoppingCart size={24} />} 
              label={isAdmin ? "Dashboard" : "Point of Sale"} 
              badge={isAdmin && pendingOrdersCount > 0 ? pendingOrdersCount : undefined}
            />
            <SidebarLink 
              active={activeTab === 'shops'} 
              onClick={() => setActiveTab('shops')} 
              icon={<Store size={24} />} 
              label="Drug Shops" 
            />
            {isAdmin && (
              <>
                <SidebarLink 
                  active={activeTab === 'report'} 
                  onClick={() => setActiveTab('report')} 
                  icon={<FileText size={24} />} 
                  label="Stock Report" 
                />
                <SidebarLink 
                  active={activeTab === 'pos'} 
                  onClick={() => setActiveTab('pos')} 
                  icon={<ShoppingCart size={24} />} 
                  label="Point of Sale" 
                />
                <SidebarLink 
                  active={activeTab === 'inventory'} 
                  onClick={() => setActiveTab('inventory')} 
                  icon={<Package size={24} />} 
                  label="Master Inventory" 
                />
                <SidebarLink 
                  active={activeTab === 'users'} 
                  onClick={() => setActiveTab('users')} 
                  icon={<UsersIcon size={24} />} 
                  label="Staff Management" 
                />
                <SidebarLink 
                  active={activeTab === 'settings'} 
                  onClick={() => setActiveTab('settings')} 
                  icon={<SettingsIcon size={24} />} 
                  label="System Settings" 
                />
              </>
            )}
            <SidebarLink 
              active={activeTab === 'messages'} 
              onClick={() => setActiveTab('messages')} 
              icon={<MessageSquare size={24} />} 
              label="Messages" 
              badge={unreadMessagesCount > 0 ? unreadMessagesCount : undefined}
            />
          </nav>

          <div className="pt-6 border-t border-zinc-100 space-y-4">
            {userProfile && (
              <div className="px-4 py-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Current Session</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setUnlockedTabs([])}
                      className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="Lock All Windows"
                    >
                      <Lock size={12} />
                    </button>
                    <button 
                      onClick={clearCache}
                      className="p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-all"
                      title="Clear Cache & Reload"
                    >
                      <RefreshCw size={12} />
                    </button>
                  </div>
                </div>
                <p className="text-xs font-bold text-zinc-900 truncate">{userProfile.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${isAdmin ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-600'}`}>
                    {userProfile.role}
                  </span>
                  {userProfile.shopId && (
                    <span className="text-[8px] font-bold text-zinc-500 truncate">
                      Shop: {userProfile.shopId.slice(0, 8)}...
                    </span>
                  )}
                </div>
              </div>
            )}
            <Auth user={user} loading={loading} />
          </div>
        </aside>
      )}

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 px-2 py-1 flex justify-around items-center z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
          <MobileNavLink 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
            icon={isAdmin ? <LayoutDashboard size={24} /> : <ShoppingCart size={24} />} 
            label={isAdmin ? "Home" : "POS"} 
            badge={isAdmin && pendingOrdersCount > 0 ? pendingOrdersCount : undefined}
          />
          <MobileNavLink 
            active={activeTab === 'shops'} 
            onClick={() => setActiveTab('shops')} 
            icon={<Store size={24} />} 
            label="Shops" 
          />
          {isAdmin && (
            <>
              <MobileNavLink 
                active={activeTab === 'report'} 
                onClick={() => setActiveTab('report')} 
                icon={<FileText size={24} />} 
                label="Report" 
              />
              <MobileNavLink 
                active={activeTab === 'pos'} 
                onClick={() => setActiveTab('pos')} 
                icon={<ShoppingCart size={24} />} 
                label="POS" 
              />
              <MobileNavLink 
                active={activeTab === 'inventory'} 
                onClick={() => setActiveTab('inventory')} 
                icon={<Package size={24} />} 
                label="Stock" 
              />
              <MobileNavLink 
                active={activeTab === 'users'} 
                onClick={() => setActiveTab('users')} 
                icon={<UsersIcon size={24} />} 
                label="Staff" 
              />
              <MobileNavLink 
                active={activeTab === 'settings'} 
                onClick={() => setActiveTab('settings')} 
                icon={<SettingsIcon size={24} />} 
                label="Settings" 
              />
            </>
          )}
          <MobileNavLink 
            active={activeTab === 'messages'} 
            onClick={() => setActiveTab('messages')} 
            icon={<MessageSquare size={24} />} 
            label="Chat" 
            badge={unreadMessagesCount > 0 ? unreadMessagesCount : undefined}
          />
        </nav>
      )}

      {/* Main Content */}
      <main className={`flex-1 ${isMobile ? 'p-4' : 'p-12'} max-w-7xl mx-auto w-full`}>
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <PasswordGate 
                tab="dashboard" 
                isUnlocked={unlockedTabs.includes('dashboard')} 
                onUnlock={() => setUnlockedTabs(prev => [...prev, 'dashboard'])}
                password={accessPassword}
              >
                {isAdmin ? (
                  <AdminDashboard onNavigate={(tab) => setActiveTab(tab)} />
                ) : (
                  userProfile && <PersonnelDashboard userProfile={userProfile} />
                )}
              </PasswordGate>
            </motion.div>
          )}

          {activeTab === 'messages' && (
            <motion.div key="messages" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Messages userProfile={userProfile!} />
            </motion.div>
          )}

          {activeTab === 'inventory' && isAdmin && (
            <motion.div key="inventory" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Inventory />
            </motion.div>
          )}

          {activeTab === 'shops' && (
            <motion.div key="shops" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <PasswordGate 
                tab="shops" 
                isUnlocked={unlockedTabs.includes('shops')} 
                onUnlock={() => setUnlockedTabs(prev => [...prev, 'shops'])}
                password={accessPassword}
              >
                <Shops userProfile={userProfile!} />
              </PasswordGate>
            </motion.div>
          )}

          {activeTab === 'users' && isAdmin && (
            <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <PasswordGate 
                tab="users" 
                isUnlocked={unlockedTabs.includes('users')} 
                onUnlock={() => setUnlockedTabs(prev => [...prev, 'users'])}
                password={accessPassword}
              >
                <Users />
              </PasswordGate>
            </motion.div>
          )}

          {activeTab === 'settings' && isAdmin && (
            <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <PasswordGate 
                tab="settings" 
                isUnlocked={unlockedTabs.includes('settings')} 
                onUnlock={() => setUnlockedTabs(prev => [...prev, 'settings'])}
                password={accessPassword}
              >
                <Settings currentPassword={accessPassword} />
              </PasswordGate>
            </motion.div>
          )}

          {activeTab === 'report' && (
            <motion.div key="report" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <StockReport userProfile={userProfile!} />
            </motion.div>
          )}

          {activeTab === 'pos' && isAdmin && (
            <motion.div key="pos" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {!selectedShopIdForPOS ? (
                <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm max-w-2xl mx-auto">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Point of Sale</span>
                  <h2 className="text-2xl font-black text-zinc-900 mb-2">Select Shop to Enter Sales</h2>
                  <p className="text-zinc-500 text-sm mb-8">Choose a shop location to start recording drug sales and managing its specific inventory.</p>
                  <ShopSelector onSelect={(id) => setSelectedShopIdForPOS(id)} />
                </div>
              ) : (
                <div className="space-y-4">
                  <button 
                    onClick={() => setSelectedShopIdForPOS(null)}
                    className="text-sm font-bold text-zinc-500 hover:text-zinc-900 flex items-center gap-2 mb-4"
                  >
                    ← Switch Shop
                  </button>
                  {userProfile && (
                    <PersonnelDashboard 
                      key={selectedShopIdForPOS}
                      userProfile={{
                        ...userProfile,
                        shopId: selectedShopIdForPOS
                      }} 
                    />
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
    </ErrorBoundary>
  );
}

const PasswordGate = ({ tab, isUnlocked, onUnlock, children, password }: { tab: string; isUnlocked: boolean; onUnlock: () => void; children: React.ReactNode; password: string }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === password) {
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  if (isUnlocked) return <>{children}</>;

  const labels: Record<string, string> = {
    dashboard: 'Home / Dashboard',
    users: 'Staff Management',
    shops: 'Drug Shops',
    settings: 'System Settings'
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-zinc-100 w-full max-w-md text-center"
      >
        <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg">
          <Lock className="text-white" size={40} />
        </div>
        <h2 className="text-2xl font-black text-zinc-900 mb-2 tracking-tight">Window Locked</h2>
        <p className="text-zinc-500 text-sm mb-8">
          The <span className="font-bold text-zinc-900">{labels[tab] || tab}</span> window is protected. Please enter the access password to continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter Password"
              className={`w-full px-6 py-4 bg-zinc-50 border ${error ? 'border-rose-500 ring-2 ring-rose-100' : 'border-zinc-200 focus:border-zinc-900'} rounded-2xl text-center font-bold text-xl tracking-[0.5em] transition-all outline-none`}
              autoFocus
            />
            {error && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-600 text-xs font-bold mt-2"
              >
                Incorrect Password. Please try again.
              </motion.p>
            )}
          </div>
          <button
            type="submit"
            className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-zinc-200"
          >
            <Unlock size={20} />
            Unlock Window
          </button>
        </form>
        
        <div className="mt-8 pt-8 border-t border-zinc-100 flex items-center justify-center gap-4 text-zinc-400">
          <Key size={16} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Secure Access Required</span>
        </div>
      </motion.div>
    </div>
  );
};

const Settings = ({ currentPassword }: { currentPassword: string }) => {
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      setMessage({ type: 'error', text: 'Password must be at least 4 characters long.' });
      return;
    }

    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'access_password'), { value: newPassword });
      setMessage({ type: 'success', text: 'Access password updated successfully!' });
      setNewPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
      setMessage({ type: 'error', text: 'Failed to update password. Please try again.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight">System Settings</h1>
        <p className="text-zinc-500">Manage global application configurations and security.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-md">
              <Lock className="text-white" size={20} />
            </div>
            <h2 className="text-xl font-black text-zinc-900">Window Access Password</h2>
          </div>

          <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
            Change the password required to unlock the Home, Admin overview, Staff, Shops, and Settings windows. 
            The current password is <span className="font-mono font-bold text-zinc-900">"{currentPassword}"</span>.
          </p>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">New Password</label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-zinc-900 transition-all outline-none font-bold"
              />
            </div>

            {message && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-xs font-bold ${message.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}
              >
                {message.text}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <RefreshCw size={18} />
                  Update Password
                </>
              )}
            </button>
          </form>
        </div>

        <div className="bg-zinc-900 p-8 rounded-3xl text-white shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <ShieldAlert className="text-white" size={20} />
            </div>
            <h2 className="text-xl font-black">Security Notice</h2>
          </div>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            This password protects sensitive windows from unauthorized viewing. 
            It is shared across all devices. Ensure you share the new password 
            only with authorized personnel.
          </p>
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
            <p className="text-xs font-bold text-zinc-500 uppercase mb-2 tracking-widest">Best Practices</p>
            <ul className="text-xs text-zinc-300 space-y-2">
              <li>• Use at least 4 characters</li>
              <li>• Change it periodically</li>
              <li>• Avoid using easily guessable sequences</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const ShopSelector = ({ onSelect }: { onSelect: (id: string) => void }) => {
  const [shops, setShops] = React.useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'shops'), (snapshot) => {
      setShops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      // Use a local console error or the global handler if accessible
      console.error('ShopSelector listener error:', error);
    });
    return () => unsub();
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {shops.map(shop => (
        <button
          key={shop.id}
          onClick={() => onSelect(shop.id)}
          className="p-6 bg-zinc-50 border border-zinc-200 rounded-2xl text-left hover:border-zinc-900 transition-all group"
        >
          <p className="font-bold text-zinc-900 text-lg">{shop.name}</p>
          <p className="text-sm text-zinc-500">{shop.location}</p>
        </button>
      ))}
    </div>
  );
};

const SidebarLink = ({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) => (
  <button
    onClick={onClick}
    title={label}
    className={`flex items-center justify-between w-full px-4 py-4 rounded-xl text-base font-bold transition-all ${active ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-200' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'}`}
  >
    <div className="flex items-center gap-3">
      {icon}
      {label}
    </div>
    {badge !== undefined && (
      <span className="bg-rose-600 text-white text-[10px] px-2 py-0.5 rounded-full min-w-[20px] text-center">
        {badge}
      </span>
    )}
  </button>
);

const MobileNavLink = ({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) => (
  <button
    onClick={onClick}
    title={label}
    className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all relative ${active ? 'text-zinc-900' : 'text-zinc-400'}`}
  >
    <div className={`${active ? 'scale-110' : 'scale-100'} transition-transform relative`}>
      {icon}
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[8px] px-1 rounded-full min-w-[14px] text-center border border-white">
          {badge}
        </span>
      )}
    </div>
    <span className={`text-[10px] font-bold uppercase tracking-tighter ${active ? 'opacity-100' : 'opacity-60'}`}>
      {label}
    </span>
  </button>
);
