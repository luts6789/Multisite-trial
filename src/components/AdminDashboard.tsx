import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Shop, Sale, Drug, Expense, ExtraSale, Order, Debt } from '../types';
import { formatCurrency, handleFirestoreError } from '../utils';
import { LayoutDashboard, Store, TrendingUp, Package, AlertTriangle, Calendar, ChevronRight, X, Receipt, Banknote, ClipboardList, Check, MessageSquare, Plus, RotateCcw, RefreshCcw, UserPlus, Truck, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { startOfDay, startOfWeek, startOfMonth, endOfDay, isWithinInterval, format, subDays, isSameDay } from 'date-fns';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';

interface AdminDashboardProps {
  onNavigate: (tab: 'dashboard' | 'inventory' | 'users' | 'report' | 'pos' | 'shops' | 'messages') => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string | 'all'>('all');
  const [sales, setSales] = useState<Sale[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [extraSales, setExtraSales] = useState<ExtraSale[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportRange, setReportRange] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [activeAlert, setActiveAlert] = useState<'low' | 'expired' | 'orders' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetNotification, setResetNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showQuickAddShop, setShowQuickAddShop] = useState(false);
  const [showQuickAddStaff, setShowQuickAddStaff] = useState(false);
  const [newShop, setNewShop] = useState({ name: '', location: '' });
  const [newStaff, setNewStaff] = useState({ email: '', role: 'personnel' as const, shopId: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleError = (err: any, collection: string) => {
      console.error(`Error fetching ${collection}:`, err);
      if (err.message?.includes('insufficient permissions')) {
        setError(`Permission denied for ${collection}. Please ensure you are an administrator.`);
      } else {
        setError(`Failed to load ${collection}. Please check your connection.`);
      }
      setLoading(false);
    };

    const unsubShops = onSnapshot(collection(db, 'shops'), 
      (snapshot) => setShops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop))),
      (err) => handleError(err, 'shops')
    );

    const unsubSales = onSnapshot(collection(db, 'sales'), 
      (snapshot) => setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale))),
      (err) => handleError(err, 'sales')
    );

    const unsubDrugs = onSnapshot(collection(db, 'drugs'), 
      (snapshot) => setDrugs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Drug))),
      (err) => handleError(err, 'drugs')
    );

    const unsubExpenses = onSnapshot(collection(db, 'expenses'), 
      (snapshot) => setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense))),
      (err) => handleError(err, 'expenses')
    );

    const unsubExtraSales = onSnapshot(collection(db, 'extraSales'), 
      (snapshot) => setExtraSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtraSale))),
      (err) => handleError(err, 'extraSales')
    );

    const unsubOrders = onSnapshot(collection(db, 'orders'), 
      (snapshot) => {
        setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
        setLoading(false);
      },
      (err) => handleError(err, 'orders')
    );

    const unsubDebts = onSnapshot(collection(db, 'debts'), 
      (snapshot) => setDebts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt))),
      (err) => handleError(err, 'debts')
    );

    return () => {
      unsubShops();
      unsubSales();
      unsubDrugs();
      unsubExpenses();
      unsubExtraSales();
      unsubOrders();
      unsubDebts();
    };
  }, []);

  const handleApproveOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'approved',
        updatedAt: Timestamp.now()
      });
      setResetNotification({ message: 'Order approved successfully!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, 'update', 'orders');
    }
  };

  const handleQuickAddShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { addDoc } = await import('firebase/firestore');
      await addDoc(collection(db, 'shops'), {
        ...newShop,
        lowStockLimit: 10,
        createdAt: Timestamp.now()
      });
      setNewShop({ name: '', location: '' });
      setShowQuickAddShop(false);
      setResetNotification({ message: 'Shop location added successfully!', type: 'success' });
    } catch (error) {
      setResetNotification({ message: 'Failed to add shop.', type: 'error' });
      handleFirestoreError(error, 'create', 'shops');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { setDoc } = await import('firebase/firestore');
      const email = newStaff.email.toLowerCase();
      const userId = email.replace(/[^a-zA-Z0-9]/g, '_');
      await setDoc(doc(db, 'users', userId), { ...newStaff, email });
      setNewStaff({ email: '', role: 'personnel', shopId: '' });
      setShowQuickAddStaff(false);
      setResetNotification({ message: 'Staff profile pre-provisioned successfully!', type: 'success' });
    } catch (error) {
      setResetNotification({ message: 'Failed to add staff.', type: 'error' });
      handleFirestoreError(error, 'create', 'users');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSystemReset = async () => {
    setIsResetting(true);
    try {
      const collectionsToClear = [
        'shops',
        'drugs',
        'sales',
        'deliveries',
        'orders',
        'expenses',
        'extraSales',
        'debts',
        'messages'
      ];

      for (const collName of collectionsToClear) {
        const snapshot = await getDocs(collection(db, collName));
        const docs = snapshot.docs;
        
        for (let i = 0; i < docs.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 500);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }

      const usersSnapshot = await getDocs(collection(db, 'users'));
      const userDocs = usersSnapshot.docs;
      
      for (let i = 0; i < userDocs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = userDocs.slice(i, i + 500);
        let deletedInBatch = 0;
        
        chunk.forEach(d => {
          const data = d.data();
          const email = data.email?.toLowerCase();
          if (email !== 'thevalleyviewdrugshop@gmail.com') {
            batch.delete(d.ref);
            deletedInBatch++;
          }
        });
        
        if (deletedInBatch > 0) {
          await batch.commit();
        }
      }

      setResetNotification({ message: 'System reset successful. All entries cleared.', type: 'success' });
      setShowResetConfirm(false);
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error('System reset error:', error);
      setResetNotification({ message: 'Failed to perform system reset.', type: 'error' });
      handleFirestoreError(error, 'delete', 'all');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeclineOrder = async (orderId: string) => {
    if (!rejectionReason.trim()) return;
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'declined',
        rejectionReason: rejectionReason.trim(),
        updatedAt: Timestamp.now()
      });
      setRejectingOrderId(null);
      setRejectionReason('');
    } catch (error) {
      handleFirestoreError(error, 'update', 'orders');
    }
  };

  const filteredSales = selectedShopId === 'all' ? sales : sales.filter(s => s.shopId === selectedShopId);
  const filteredDrugs = selectedShopId === 'all' ? drugs : drugs.filter(d => d.shopId === selectedShopId);
  const filteredExpenses = selectedShopId === 'all' ? expenses : expenses.filter(e => e.shopId === selectedShopId);
  const filteredExtraSales = selectedShopId === 'all' ? extraSales : extraSales.filter(es => es.shopId === selectedShopId);
  const filteredDebts = selectedShopId === 'all' ? debts : debts.filter(d => d.shopId === selectedShopId);

  const now = new Date();
  const getRangeStart = () => {
    switch (reportRange) {
      case 'today': return startOfDay(now);
      case 'week': return startOfWeek(now);
      case 'month': return startOfMonth(now);
      default: return new Date(0);
    }
  };

  const rangeStart = getRangeStart();
  const rangeSales = filteredSales.filter(s => s.timestamp.toDate() >= rangeStart);
  const rangeExpenses = filteredExpenses.filter(e => e.timestamp.toDate() >= rangeStart);
  const rangeExtraSales = filteredExtraSales.filter(es => es.timestamp.toDate() >= rangeStart);

  const totalSalesAmount = rangeSales.reduce((acc, s) => acc + s.totalPrice, 0) + rangeExtraSales.reduce((acc, es) => acc + es.amount, 0);
  const totalGrossProfit = rangeSales.reduce((acc, s) => acc + s.profit, 0) + rangeExtraSales.reduce((acc, es) => acc + es.amount, 0);
  const totalExpensesAmount = rangeExpenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = totalGrossProfit - totalExpensesAmount;

  const expiredDrugs = filteredDrugs.filter(d => new Date(d.expiryDate) < now);
  const lowStockDrugs = filteredDrugs.filter(d => {
    const shop = shops.find(s => s.id === d.shopId);
    return d.quantity < (shop?.lowStockLimit || 10);
  });
  const totalInventoryValue = filteredDrugs.reduce((acc, d) => acc + (d.costPrice * d.quantity), 0);

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    const daySales = filteredSales.filter(s => {
      const t = s.timestamp.toDate();
      return t >= dayStart && t <= dayEnd;
    });
    const dayExtraSales = filteredExtraSales.filter(es => {
      const t = es.timestamp.toDate();
      return t >= dayStart && t <= dayEnd;
    });
    return {
      name: format(date, 'EEE'),
      sales: daySales.reduce((acc, s) => acc + s.totalPrice, 0) + dayExtraSales.reduce((acc, es) => acc + es.amount, 0),
      profit: daySales.reduce((acc, s) => acc + s.profit, 0) + dayExtraSales.reduce((acc, es) => acc + es.amount, 0),
    };
  });

  const sortedSales = [...filteredSales].sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);

  const drugSalesCount = filteredSales.reduce((acc, sale) => {
    acc[sale.drugName] = (acc[sale.drugName] || 0) + sale.quantity;
    return acc;
  }, {} as Record<string, number>);

  const fastMovingDrugs = Object.entries(drugSalesCount)
    .map(([name, count]) => ({ name, count: count as number }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="bg-rose-50 border border-rose-200 p-8 rounded-[2.5rem] max-w-md text-center">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-xl font-black text-rose-900 mb-2">Access Error</h3>
          <p className="text-rose-700 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="h-64 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
    </div>;
  }

  if (shops.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full bg-white p-12 rounded-[3rem] shadow-xl border border-zinc-200 text-center"
        >
          <div className="w-24 h-24 bg-zinc-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
            <Store className="text-zinc-400" size={48} />
          </div>
          <h2 className="text-3xl font-black text-zinc-900 mb-4">Welcome to PharmaTrack</h2>
          <p className="text-zinc-500 mb-10 leading-relaxed text-lg">
            To get started, you need to create your first drug shop location. 
            This will allow you to manage inventory and staff for that site.
          </p>
          <div className="space-y-6">
            <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Quick Start Guide</p>
            <ol className="text-left text-zinc-600 space-y-3 mb-8 bg-zinc-50 p-6 rounded-2xl border border-zinc-100">
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <span>Go to the <strong>Drug Shops</strong> section to set up your first shop.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <span>Go to <strong>Master Inventory</strong> to add your first drug delivery to that shop.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <span>Assign staff members in the <strong>Staff Management</strong> tab.</span>
              </li>
            </ol>
            <button
              onClick={() => onNavigate('shops')}
              className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
            >
              <Plus size={20} />
              Set Up Your First Shop
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const pendingOrders = orders.filter(o => o.status === 'pending');

  return (
    <div className="space-y-8">
      {/* Reset Notification Toast */}
      <AnimatePresence>
        {resetNotification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 ${
              resetNotification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}
          >
            <Check className="w-5 h-5" />
            <span className="font-medium">{resetNotification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* System Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-zinc-100"
            >
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-6">
                <RotateCcw className="text-amber-600" size={32} />
              </div>
              <h3 className="text-2xl font-black text-zinc-900 mb-2">Factory Reset?</h3>
              <p className="text-zinc-500 mb-8 leading-relaxed">
                This will <span className="font-bold text-rose-600 uppercase">delete all entries</span> including shops, drugs, sales, and personnel accounts. 
                Admin accounts will be preserved. This action <span className="font-bold text-zinc-900 underline">cannot be undone</span>.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  disabled={isResetting}
                  onClick={handleSystemReset}
                  className="w-full py-4 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isResetting ? (
                    <>
                      <RefreshCcw className="w-5 h-5 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    'Yes, Delete Everything'
                  )}
                </button>
                <button
                  disabled={isResetting}
                  onClick={() => setShowResetConfirm(false)}
                  className="w-full py-4 bg-zinc-100 text-zinc-900 rounded-xl font-bold hover:bg-zinc-200 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Add Shop Modal */}
      <AnimatePresence>
        {showQuickAddShop && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-zinc-100"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                  <Store className="text-emerald-600" size={24} />
                </div>
                <button onClick={() => setShowQuickAddShop(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X size={20} className="text-zinc-400" />
                </button>
              </div>
              <h3 className="text-2xl font-black text-zinc-900 mb-2">Add New Shop</h3>
              <p className="text-zinc-500 mb-6 text-sm">Create a new drug shop location to start managing its inventory and staff.</p>
              
              <form onSubmit={handleQuickAddShop} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1 ml-1">Shop Name</label>
                  <input 
                    required 
                    type="text" 
                    value={newShop.name} 
                    onChange={e => setNewShop({...newShop, name: e.target.value})} 
                    className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all" 
                    placeholder="e.g. Central Pharmacy" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1 ml-1">Location</label>
                  <input 
                    required 
                    type="text" 
                    value={newShop.location} 
                    onChange={e => setNewShop({...newShop, location: e.target.value})} 
                    className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all" 
                    placeholder="e.g. Downtown, Block A" 
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                >
                  {isSubmitting ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Plus size={20} />}
                  Create Shop
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Add Staff Modal */}
      <AnimatePresence>
        {showQuickAddStaff && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-zinc-100"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                  <UserPlus className="text-indigo-600" size={24} />
                </div>
                <button onClick={() => setShowQuickAddStaff(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X size={20} className="text-zinc-400" />
                </button>
              </div>
              <h3 className="text-2xl font-black text-zinc-900 mb-2">Add New Staff</h3>
              <p className="text-zinc-500 mb-6 text-sm">Pre-provision a staff account. They will gain access when they log in with this email.</p>
              
              <form onSubmit={handleQuickAddStaff} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1 ml-1">Email Address</label>
                  <input 
                    required 
                    type="email" 
                    value={newStaff.email} 
                    onChange={e => setNewStaff({...newStaff, email: e.target.value})} 
                    className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all" 
                    placeholder="staff@example.com" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1 ml-1">Role</label>
                    <select 
                      value={newStaff.role} 
                      onChange={e => setNewStaff({...newStaff, role: e.target.value as any})} 
                      className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    >
                      <option value="personnel">Personnel</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1 ml-1">Assign Shop</label>
                    <select 
                      value={newStaff.shopId} 
                      onChange={e => setNewStaff({...newStaff, shopId: e.target.value})} 
                      className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    >
                      <option value="">None</option>
                      {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                >
                  {isSubmitting ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Plus size={20} />}
                  Save Staff Profile
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Dashboard</span>
          <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Admin Overview</h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-zinc-500">Monitor all drug shop locations, sales performance, and system health from one place.</p>
            {lowStockDrugs.length > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-full border border-amber-100">
                <AlertTriangle size={10} />
                {lowStockDrugs.length} Low Stock
              </span>
            )}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-all text-sm font-bold"
            title="Factory Reset System"
          >
            <RotateCcw size={18} />
            Reset System
          </button>
          <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            {(['today', 'week', 'month', 'all'] as const).map(range => (
              <button
                key={range}
                onClick={() => setReportRange(range)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${reportRange === range ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                {range}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-zinc-200 shadow-sm overflow-x-auto no-scrollbar max-w-full">
            <button
              onClick={() => setSelectedShopId('all')}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${selectedShopId === 'all' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-600 hover:bg-zinc-50'}`}
            >
              All Shops
            </button>
            {shops.map(shop => (
              <button
                key={shop.id}
                onClick={() => setSelectedShopId(shop.id)}
                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${selectedShopId === shop.id ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-600 hover:bg-zinc-50'}`}
              >
                {shop.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {lowStockDrugs.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="font-bold text-amber-900">{lowStockDrugs.length} items are low in stock</p>
              <p className="text-sm text-amber-700">Check inventory levels across shops to ensure availability.</p>
            </div>
          </div>
          <button 
            onClick={() => setActiveAlert('low')}
            className="w-full sm:w-auto px-6 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-all shadow-sm"
          >
            View Low Stock Items
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6">
        <StatCard title="Net Profit" value={formatCurrency(netProfit)} icon={<TrendingUp className="text-emerald-500" />} subtitle={`Sales: ${formatCurrency(totalSalesAmount)}`} />
        <StatCard title="Expenses" value={formatCurrency(totalExpensesAmount)} icon={<Receipt className="text-rose-500" />} />
        <StatCard title="Inventory Value" value={formatCurrency(totalInventoryValue)} icon={<Package className="text-zinc-500" />} />
        <StatCard 
          title="Pending Orders" 
          value={pendingOrders.length.toString()} 
          icon={<ClipboardList className="text-indigo-500" />} 
          onClick={() => setActiveAlert('orders')}
          clickable
        />
        <StatCard 
          title="Low Stock" 
          value={lowStockDrugs.length.toString()} 
          icon={<Package className="text-amber-500" />} 
          onClick={() => setActiveAlert('low')}
          clickable
        />
        <StatCard 
          title="Expired Drugs" 
          value={expiredDrugs.length.toString()} 
          icon={<AlertTriangle className="text-rose-500" />} 
          onClick={() => setActiveAlert('expired')}
          clickable
        />
        <StatCard 
          title="Outstanding Debts" 
          value={filteredDebts.filter(d => d.status === 'unpaid').length.toString()} 
          icon={<AlertTriangle className="text-amber-500" />} 
          subtitle={`Total: ${formatCurrency(filteredDebts.filter(d => d.status === 'unpaid').reduce((acc, d) => acc + d.amount, 0))}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <TrendingUp size={20} />
              Sales & Profit (Last 7 Days)
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#f4f4f5' }}
                  />
                  <Bar dataKey="sales" fill="#18181b" radius={[4, 4, 0, 0]} name="Total Sales" />
                  <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} name="Profit" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Activity size={20} />
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <QuickActionButton 
                onClick={() => setShowQuickAddShop(true)} 
                icon={<Plus size={20} />} 
                label="Add Shop" 
                color="bg-emerald-600"
              />
              <QuickActionButton 
                onClick={() => setShowQuickAddStaff(true)} 
                icon={<UserPlus size={20} />} 
                label="Add Staff" 
                color="bg-indigo-600"
              />
              <QuickActionButton 
                onClick={() => onNavigate('inventory')} 
                icon={<Truck size={20} />} 
                label="Send Stock" 
                color="bg-zinc-900"
              />
              <QuickActionButton 
                onClick={() => onNavigate('messages')} 
                icon={<MessageSquare size={20} />} 
                label="Messages" 
                color="bg-amber-600"
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Store size={20} />
              Shop Performance
            </h3>
            <button 
              onClick={() => setShowQuickAddShop(true)}
              className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all"
              title="Add New Shop"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="space-y-4">
            {shops.map(shop => {
              const shopSales = sales.filter(s => s.shopId === shop.id);
              const shopExtraSales = extraSales.filter(es => es.shopId === shop.id);
              const shopTotal = shopSales.reduce((acc, s) => acc + s.totalPrice, 0) + shopExtraSales.reduce((acc, es) => acc + es.amount, 0);
              
              const shopLowStock = lowStockDrugs.filter(d => d.shopId === shop.id).length;
              
              return (
                <div key={shop.id} className="p-4 rounded-xl border border-zinc-100 bg-zinc-50/50">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900">{shop.name}</span>
                      {shopLowStock > 0 && (
                        <div className="group relative">
                          <AlertTriangle size={14} className="text-amber-500 animate-pulse" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            {shopLowStock} items low in stock
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {formatCurrency(shopTotal)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">{shop.location}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-500" />
            Outstanding Debts
          </h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {filteredDebts.filter(d => d.status === 'unpaid').length === 0 ? (
              <div className="text-center py-12">
                <Check className="mx-auto text-zinc-200 mb-2" size={40} />
                <p className="text-zinc-400 font-medium">No outstanding debts</p>
              </div>
            ) : (
              filteredDebts.filter(d => d.status === 'unpaid').map(debt => {
                const dueDate = new Date(debt.anticipatedPaymentDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isOverdue = dueDate < today;

                return (
                  <div key={debt.id} className={`p-4 rounded-xl border ${isOverdue ? 'border-rose-200 bg-rose-50/50' : 'border-zinc-100 bg-zinc-50/50'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex flex-col">
                        <span className="font-bold text-zinc-900">{debt.patientName}</span>
                        <span className="text-[10px] text-zinc-500 font-medium">{debt.patientPhone}</span>
                      </div>
                      <span className="text-sm font-black text-rose-600">{formatCurrency(debt.amount)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-xs text-zinc-500">{debt.drugName} (x{debt.quantity})</p>
                      <div className="flex flex-col items-end">
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${isOverdue ? 'text-rose-600' : 'text-zinc-400'}`}>
                          Due: {format(dueDate, 'MMM dd')}
                        </p>
                        {isOverdue && <span className="text-[8px] font-black text-rose-500 uppercase">Overdue</span>}
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">Shop: {shops.find(s => s.id === debt.shopId)?.name}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <TrendingUp size={20} />
          Recent Transactions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="pb-4 text-xs font-bold text-zinc-400 uppercase">Date</th>
                <th className="pb-4 text-xs font-bold text-zinc-400 uppercase">Shop</th>
                <th className="pb-4 text-xs font-bold text-zinc-400 uppercase">Items</th>
                <th className="pb-4 text-xs font-bold text-zinc-400 uppercase text-right">Total</th>
                <th className="pb-4 text-xs font-bold text-zinc-400 uppercase text-right">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {sortedSales.slice(0, 10).map(sale => (
                <tr key={sale.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="py-4 text-sm text-zinc-600">
                    {format(sale.timestamp.toDate(), 'MMM d, HH:mm')}
                  </td>
                  <td className="py-4 text-sm font-medium text-zinc-900">
                    {shops.find(s => s.id === sale.shopId)?.name || 'Unknown'}
                  </td>
                  <td className="py-4 text-sm text-zinc-600">
                    {sale.drugName} (x{sale.quantity})
                  </td>
                  <td className="py-4 text-sm font-bold text-zinc-900 text-right">
                    {formatCurrency(sale.totalPrice)}
                  </td>
                  <td className="py-4 text-sm font-bold text-emerald-600 text-right">
                    {formatCurrency(sale.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Package size={20} className="text-emerald-600" />
          Fast Moving Drugs (Top 5)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {fastMovingDrugs.length === 0 ? (
            <p className="text-zinc-500 text-sm col-span-5 text-center py-8">No sales data available yet.</p>
          ) : (
            fastMovingDrugs.map((drug, index) => (
              <div key={drug.name} className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10">
                  <span className="text-4xl font-black">#{index + 1}</span>
                </div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Drug Name</p>
                <p className="font-bold text-zinc-900 truncate pr-8">{drug.name}</p>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Units Sold</p>
                    <p className="text-xl font-black text-emerald-600">{drug.count}</p>
                  </div>
                  <TrendingUp size={20} className="text-emerald-500 mb-1" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {activeAlert && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black text-zinc-900">
                    {activeAlert === 'low' ? 'Low Stock Alert' : activeAlert === 'expired' ? 'Expired Drugs Alert' : 'Pending Orders'}
                  </h3>
                  <p className="text-zinc-500">
                    {activeAlert === 'low' ? `Showing ${lowStockDrugs.length} items requiring attention` : 
                     activeAlert === 'expired' ? `Showing ${expiredDrugs.length} items requiring attention` :
                     `Showing ${pendingOrders.length} orders from personnel`}
                  </p>
                </div>
                <button onClick={() => setActiveAlert(null)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-8">
                <div className="space-y-4">
                  {activeAlert === 'orders' ? (
                    pendingOrders.length > 0 ? (
                      pendingOrders.map(order => (
                        <div key={order.id} className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-zinc-900 text-lg">{order.drugName}</p>
                              <p className="text-sm text-zinc-500">
                                Shop: {shops.find(s => s.id === order.shopId)?.name}
                              </p>
                              <p className="text-sm text-zinc-500">
                                Quantity Requested: <span className="font-bold text-zinc-900">{order.quantity}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-zinc-400">{format(order.createdAt.toDate(), 'PPpp')}</p>
                            </div>
                          </div>

                          {rejectingOrderId === order.id ? (
                            <div className="space-y-3 pt-2">
                              <textarea
                                placeholder="Reason for declining..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="w-full p-3 bg-white border border-rose-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-sm"
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleDeclineOrder(order.id)}
                                  className="flex-1 py-2 bg-rose-600 text-white rounded-lg font-bold text-sm hover:bg-rose-700 transition-all"
                                >
                                  Confirm Decline
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectingOrderId(null);
                                    setRejectionReason('');
                                  }}
                                  className="px-4 py-2 bg-zinc-100 text-zinc-600 rounded-lg font-bold text-sm hover:bg-zinc-200 transition-all"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-3 pt-2">
                              <button
                                onClick={() => handleApproveOrder(order.id)}
                                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-sm"
                              >
                                <Check size={18} />
                                Approve Order
                              </button>
                              <button
                                onClick={() => setRejectingOrderId(order.id)}
                                className="flex-1 py-3 bg-white border border-rose-200 text-rose-600 rounded-xl font-bold text-sm hover:bg-rose-50 transition-all flex items-center justify-center gap-2"
                              >
                                <X size={18} />
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Store className="text-zinc-300" size={32} />
                        </div>
                        <p className="text-zinc-500 font-medium">No pending orders at the moment.</p>
                      </div>
                    )
                  ) : (
                    (activeAlert === 'low' ? lowStockDrugs : expiredDrugs).map(drug => (
                      <div key={drug.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-zinc-900 text-lg">{drug.name}</p>
                          <p className="text-sm text-zinc-500">
                            Shop: {shops.find(s => s.id === drug.shopId)?.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-black ${activeAlert === 'low' ? 'text-amber-600' : 'text-rose-600'}`}>
                            {activeAlert === 'low' ? `${drug.quantity} units` : 'EXPIRED'}
                          </p>
                          <p className="text-xs text-zinc-400">Expiry: {drug.expiryDate}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const QuickActionButton = ({ onClick, icon, label, color }: { onClick: () => void; icon: React.ReactNode; label: string; color: string }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-zinc-100 bg-zinc-50/50 hover:bg-zinc-100 transition-all group"
  >
    <div className={`w-12 h-12 ${color} text-white rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
      {icon}
    </div>
    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider text-center">{label}</span>
  </button>
);

const StatCard = ({ title, value, icon, subtitle, onClick, clickable }: { title: string; value: string; icon: React.ReactNode; subtitle?: string; onClick?: () => void; clickable?: boolean }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    onClick={onClick}
    className={`bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-4 transition-all ${clickable ? 'cursor-pointer hover:border-zinc-900 hover:shadow-md active:scale-95' : ''}`}
  >
    <div className="p-3 bg-zinc-50 rounded-xl">
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-zinc-500">{title}</p>
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      {subtitle && <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-wider">{subtitle}</p>}
    </div>
    {clickable && <ChevronRight size={16} className="ml-auto text-zinc-300" />}
  </motion.div>
);
