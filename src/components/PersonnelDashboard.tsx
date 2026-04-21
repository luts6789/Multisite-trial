import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, Timestamp, doc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Shop, Sale, Drug, UserProfile, Delivery, Order, Expense, ExtraSale, Debt } from '../types';
import { formatCurrency, handleFirestoreError } from '../utils';
import { ShoppingCart, Package, History, Search, Plus, Minus, Check, Truck, ShieldAlert, PlusCircle, X, CheckCircle, AlertCircle, ClipboardList, Receipt, MessageSquare, Trash2, Banknote, Calendar, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface PersonnelDashboardProps {
  userProfile: UserProfile;
}

export const PersonnelDashboard: React.FC<PersonnelDashboardProps> = ({ userProfile }) => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [extraSales, setExtraSales] = useState<ExtraSale[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [cart, setCart] = useState<{ drug: Drug; quantity: number }[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'history' | 'deliveries' | 'orders' | 'expenses' | 'extraSales' | 'debts'>('sales');
  const [stockSearch, setStockSearch] = useState('');
  const [editingDrugId, setEditingDrugId] = useState<string | null>(null);
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Form states
  const [newOrder, setNewOrder] = useState<{ drugName: string, quantity: number | '' }>({ drugName: '', quantity: 1 });
  const [newExpense, setNewExpense] = useState({ description: '', amount: 0 });
  const [newExtraSale, setNewExtraSale] = useState({ description: '', amount: 0 });
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [debtInfo, setDebtInfo] = useState({ patientName: '', patientPhone: '', anticipatedDate: '' });
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingDeliveryId, setRejectingDeliveryId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAdmin = userProfile.role === 'admin';

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (!userProfile.shopId) return;

    const unsubShop = onSnapshot(doc(db, 'shops', userProfile.shopId), (snapshot) => {
      setShop({ id: snapshot.id, ...snapshot.data() } as Shop);
    }, (err) => handleFirestoreError(err, 'get', `shops/${userProfile.shopId}`));

    const qDrugs = query(collection(db, 'drugs'), where('shopId', '==', userProfile.shopId));
    const unsubDrugs = onSnapshot(qDrugs, (snapshot) => {
      setDrugs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Drug)));
    }, (err) => handleFirestoreError(err, 'list', 'drugs'));

    const qSales = query(collection(db, 'sales'), where('shopId', '==', userProfile.shopId));
    const unsubSales = onSnapshot(qSales, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)).sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()));
    }, (err) => handleFirestoreError(err, 'list', 'sales'));

    const qDeliveries = query(collection(db, 'deliveries'), where('shopId', '==', userProfile.shopId), where('status', '==', 'pending'));
    const unsubDeliveries = onSnapshot(qDeliveries, (snapshot) => {
      setDeliveries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Delivery)));
    }, (err) => handleFirestoreError(err, 'list', 'deliveries'));

    const qOrders = query(collection(db, 'orders'), where('shopId', '==', userProfile.shopId));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)).sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
    }, (err) => handleFirestoreError(err, 'list', 'orders'));

    const qExpenses = query(collection(db, 'expenses'), where('shopId', '==', userProfile.shopId));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)).sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()));
    }, (err) => handleFirestoreError(err, 'list', 'expenses'));

    const qExtraSales = query(collection(db, 'extraSales'), where('shopId', '==', userProfile.shopId));
    const unsubExtraSales = onSnapshot(qExtraSales, (snapshot) => {
      setExtraSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtraSale)).sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()));
    }, (err) => handleFirestoreError(err, 'list', 'extraSales'));

    const qDebts = query(collection(db, 'debts'), where('shopId', '==', userProfile.shopId));
    const unsubDebts = onSnapshot(qDebts, (snapshot) => {
      setDebts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt)).sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()));
    }, (err) => handleFirestoreError(err, 'list', 'debts'));

    return () => {
      unsubShop();
      unsubDrugs();
      unsubSales();
      unsubDeliveries();
      unsubOrders();
      unsubExpenses();
      unsubExtraSales();
      unsubDebts();
    };
  }, [userProfile.shopId]);

  const handleConfirmDelivery = async (delivery: Delivery) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'deliveries', delivery.id), {
        status: 'confirmed'
      });

      const existingDrug = drugs.find(d => d.name.toLowerCase() === delivery.drugName.toLowerCase());
      
      if (existingDrug) {
        await updateDoc(doc(db, 'drugs', existingDrug.id), {
          quantity: increment(delivery.quantity)
        });
      } else {
        await addDoc(collection(db, 'drugs'), {
          name: delivery.drugName,
          shopId: delivery.shopId,
          costPrice: delivery.costPrice,
          sellingPrice: delivery.sellingPrice,
          quantity: delivery.quantity,
          expiryDate: delivery.expiryDate
        });
      }

      // Update delivery status to confirmed
      await updateDoc(doc(db, 'deliveries', delivery.id), {
        status: 'confirmed'
      });

      setNotification({ message: 'Stock confirmed and added to inventory!', type: 'success' });
    } catch (error) {
      setNotification({ message: 'Failed to confirm stock.', type: 'error' });
      handleFirestoreError(error, 'update', 'deliveries');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclineDelivery = async (deliveryId: string) => {
    if (!rejectionReason.trim() || isSubmitting) {
      setNotification({ message: 'Please provide a reason for rejection.', type: 'error' });
      return;
    }
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'deliveries', deliveryId), {
        status: 'declined',
        rejectionReason: rejectionReason.trim()
      });
      setRejectingDeliveryId(null);
      setRejectionReason('');
      setNotification({ message: 'Delivery declined.', type: 'success' });
    } catch (error) {
      setNotification({ message: 'Failed to decline delivery.', type: 'error' });
      handleFirestoreError(error, 'update', 'deliveries');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.drugName || !newOrder.quantity || newOrder.quantity <= 0) {
      setNotification({ message: 'Please enter a valid drug name and quantity.', type: 'error' });
      return;
    }
    try {
      await addDoc(collection(db, 'orders'), {
        shopId: userProfile.shopId,
        drugName: newOrder.drugName,
        quantity: newOrder.quantity,
        status: 'pending',
        createdAt: Timestamp.now(),
        personnelId: userProfile.id
      });
      setNewOrder({ drugName: '', quantity: 1 });
      setNotification({ message: 'Order placed successfully!', type: 'success' });
    } catch (error) {
      setNotification({ message: 'Failed to place order.', type: 'error' });
      handleFirestoreError(error, 'create', 'orders');
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.description || newExpense.amount <= 0) return;
    try {
      await addDoc(collection(db, 'expenses'), {
        shopId: userProfile.shopId,
        description: newExpense.description,
        amount: newExpense.amount,
        timestamp: Timestamp.now(),
        personnelId: userProfile.id
      });
      setNewExpense({ description: '', amount: 0 });
      setNotification({ message: 'Expense recorded successfully!', type: 'success' });
    } catch (error) {
      setNotification({ message: 'Failed to record expense.', type: 'error' });
      handleFirestoreError(error, 'create', 'expenses');
    }
  };

  const handleAddExtraSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExtraSale.description || newExtraSale.amount <= 0) return;
    try {
      await addDoc(collection(db, 'extraSales'), {
        shopId: userProfile.shopId,
        description: newExtraSale.description,
        amount: newExtraSale.amount,
        timestamp: Timestamp.now(),
        personnelId: userProfile.id
      });
      setNewExtraSale({ description: '', amount: 0 });
      setNotification({ message: 'Extra sale recorded successfully!', type: 'success' });
    } catch (error) {
      setNotification({ message: 'Failed to record extra sale.', type: 'error' });
      handleFirestoreError(error, 'create', 'extraSales');
    }
  };

  const addToCart = (drug: Drug) => {
    const existing = cart.find(item => item.drug.id === drug.id);
    if (existing) {
      if (existing.quantity < drug.quantity) {
        setCart(cart.map(item => item.drug.id === drug.id ? { ...item, quantity: item.quantity + 1 } : item));
      }
    } else {
      setCart([...cart, { drug, quantity: 1 }]);
    }
  };

  const updateCartQuantity = (drugId: string, quantity: number) => {
    const drug = drugs.find(d => d.id === drugId);
    if (!drug) return;
    
    const safeQuantity = Math.max(1, Math.min(quantity, drug.quantity));
    setCart(cart.map(item => item.drug.id === drugId ? { ...item, quantity: safeQuantity } : item));
  };

  const removeFromCart = (drugId: string) => {
    const existing = cart.find(item => item.drug.id === drugId);
    if (existing && existing.quantity > 1) {
      setCart(cart.map(item => item.drug.id === drugId ? { ...item, quantity: item.quantity - 1 } : item));
    } else {
      setCart(cart.filter(item => item.drug.id !== drugId));
    }
  };

  const handleCheckout = async (isDebt: boolean = false) => {
    if (cart.length === 0 || isSubmitting) return;
    if (isDebt && (!debtInfo.patientName || !debtInfo.patientPhone || !debtInfo.anticipatedDate)) {
      setNotification({ message: 'Please provide patient name, phone, and anticipated payment date.', type: 'error' });
      return;
    }
    setIsSubmitting(true);

    try {
      const { writeBatch, doc, collection } = await import('firebase/firestore');
      const batch = writeBatch(db);

      for (const item of cart) {
        const profit = (item.drug.sellingPrice - item.drug.costPrice) * item.quantity;
        const totalPrice = item.drug.sellingPrice * item.quantity;

        if (isDebt) {
          const debtRef = doc(collection(db, 'debts'));
          batch.set(debtRef, {
            shopId: userProfile.shopId,
            patientName: debtInfo.patientName,
            patientPhone: debtInfo.patientPhone,
            drugId: item.drug.id,
            drugName: item.drug.name,
            quantity: item.quantity,
            amount: totalPrice,
            profit,
            anticipatedPaymentDate: debtInfo.anticipatedDate,
            status: 'unpaid',
            timestamp: Timestamp.now(),
            personnelId: userProfile.id
          });
        } else {
          const saleRef = doc(collection(db, 'sales'));
          batch.set(saleRef, {
            shopId: userProfile.shopId,
            drugId: item.drug.id,
            drugName: item.drug.name,
            quantity: item.quantity,
            totalPrice,
            profit,
            timestamp: Timestamp.now(),
            personnelId: userProfile.id
          });
        }

        const drugRef = doc(db, 'drugs', item.drug.id);
        batch.update(drugRef, {
          quantity: increment(-item.quantity)
        });
      }

      await batch.commit();
      setCart([]);
      setIsDebtModalOpen(false);
      setDebtInfo({ patientName: '', patientPhone: '', anticipatedDate: '' });
      setNotification({ message: isDebt ? 'Debt recorded successfully!' : 'Sale recorded successfully!', type: 'success' });
    } catch (error) {
      console.error('Checkout error:', error);
      setNotification({ message: 'Failed to record transaction.', type: 'error' });
      handleFirestoreError(error, 'write', isDebt ? 'debts' : 'sales');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkAsPaid = async (debt: Debt) => {
    try {
      const { writeBatch, doc, collection } = await import('firebase/firestore');
      const batch = writeBatch(db);

      // 1. Update debt status
      const debtRef = doc(db, 'debts', debt.id);
      batch.update(debtRef, { status: 'paid' });

      // 2. Create a sale record
      const saleRef = doc(collection(db, 'sales'));
      batch.set(saleRef, {
        shopId: debt.shopId,
        drugId: debt.drugId,
        drugName: debt.drugName,
        quantity: debt.quantity,
        totalPrice: debt.amount,
        profit: debt.profit,
        timestamp: Timestamp.now(),
        personnelId: userProfile.id
      });

      await batch.commit();
      setNotification({ message: 'Debt marked as paid and recorded as sale!', type: 'success' });
    } catch (error) {
      setNotification({ message: 'Failed to mark debt as paid.', type: 'error' });
      handleFirestoreError(error, 'update', 'debts');
    }
  };

  const handleUpdateStock = async (drugId: string) => {
    try {
      await updateDoc(doc(db, 'drugs', drugId), {
        quantity: newQuantity
      });
      setEditingDrugId(null);
      setNotification({ message: 'Stock updated successfully!', type: 'success' });
    } catch (error) {
      setNotification({ message: 'Failed to update stock.', type: 'error' });
      handleFirestoreError(error, 'update', 'drugs');
    }
  };

  const filteredDrugs = drugs.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
  const cartTotal = cart.reduce((acc, item) => acc + (item.drug.sellingPrice * item.quantity), 0);

  if (!userProfile.shopId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-xl border border-zinc-200 text-center"
        >
          <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="text-amber-600" size={40} />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 mb-4">Awaiting Assignment</h2>
          <p className="text-zinc-500 mb-4 leading-relaxed">
            Your account has been created, but you haven't been assigned to a drug shop yet. 
            Please contact your administrator to assign you to a location.
          </p>
          <div className="bg-zinc-50 p-4 rounded-2xl text-left text-xs font-mono text-zinc-400 mb-8 overflow-auto max-h-40">
            <p>Email: {userProfile.email}</p>
            <p>UID: {userProfile.id}</p>
            <p>Role: {userProfile.role}</p>
            <p>Shop ID: {userProfile.shopId || 'None'}</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg mb-4"
          >
            Refresh Profile
          </button>
          <div className="p-4 bg-zinc-50 rounded-2xl text-xs text-zinc-400 font-mono break-all">
            User ID: {userProfile.id}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 ${
              notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-medium">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">{shop?.name || 'Loading Shop...'}</h2>
          <p className="text-zinc-500">{shop?.location}</p>
        </div>
        <div className="flex flex-col sm:flex-row bg-white/80 backdrop-blur-md p-1.5 rounded-[2rem] border border-zinc-200 gap-1 shadow-lg shadow-zinc-200/50">
          <TabButton active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} icon={<ShoppingCart size={20} />} label="Sale" />
          <TabButton 
            active={activeTab === 'deliveries'} 
            onClick={() => setActiveTab('deliveries')} 
            icon={<Truck size={20} className={deliveries.length > 0 ? "text-rose-600 animate-pulse" : ""} />} 
            label="Stock In"
            badge={deliveries.length}
          />
          {isAdmin && (
            <TabButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={20} />} label="Stock" />
          )}
          <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ClipboardList size={20} />} label="Orders" />
          <TabButton active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} icon={<Receipt size={20} />} label="Expenses" />
          <TabButton active={activeTab === 'extraSales'} onClick={() => setActiveTab('extraSales')} icon={<Banknote size={20} />} label="Extra Sales" />
          <TabButton active={activeTab === 'debts'} onClick={() => setActiveTab('debts')} icon={<AlertTriangle size={20} />} label="Debts" badge={debts.filter(d => d.status === 'unpaid').length} />
          <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={20} />} label="History" />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'deliveries' && (
          <motion.div 
            key="deliveries"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Stock In</span>
              <h3 className="text-2xl font-black text-zinc-900 flex items-center gap-2">
                <Truck size={28} />
                Confirm Stock Arrivals
              </h3>
              <p className="text-zinc-500 text-sm mt-2">Verify and accept new stock sent from the main store to add it to your inventory.</p>
            </div>

            <div className="space-y-4">
              {deliveries.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-zinc-200 text-center">
                <Truck size={48} className="mx-auto text-zinc-200 mb-4" />
                <p className="text-zinc-500 font-medium">No new stock arrivals to confirm.</p>
              </div>
            ) : (
              deliveries.map(delivery => (
                <div key={delivery.id} className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-zinc-50 rounded-xl text-zinc-400">
                      <Truck size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-900 text-lg">{delivery.drugName}</h4>
                      <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
                        <span>Quantity: <b className="text-zinc-900">{delivery.quantity}</b></span>
                        <span>Expiry: <b className="text-zinc-900">{delivery.expiryDate}</b></span>
                      </div>
                    </div>
                  </div>
                  
                  {rejectingDeliveryId === delivery.id ? (
                    <div className="flex-1 flex flex-col gap-2 max-w-md">
                      <textarea
                        placeholder="Reason for rejection..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeclineDelivery(delivery.id)}
                          className="flex-1 py-2 bg-rose-600 text-white rounded-lg font-bold text-sm hover:bg-rose-700 transition-all"
                        >
                          Submit Rejection
                        </button>
                        <button
                          onClick={() => {
                            setRejectingDeliveryId(null);
                            setRejectionReason('');
                          }}
                          className="px-4 py-2 bg-zinc-100 text-zinc-600 rounded-lg font-bold text-sm hover:bg-zinc-200 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleConfirmDelivery(delivery)}
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                      >
                        {isSubmitting && rejectingDeliveryId !== delivery.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Check size={18} />
                        )}
                        Confirm
                      </button>
                      <button
                        onClick={() => setRejectingDeliveryId(delivery.id)}
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-white border border-rose-200 text-rose-600 rounded-lg font-bold hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                      >
                        <X size={18} />
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            </div>
          </motion.div>
        )}
        {activeTab === 'sales' && (
          <motion.div 
            key="sales"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Sale</span>
              <h3 className="text-2xl font-black text-zinc-900 flex items-center gap-2">
                <ShoppingCart size={28} />
                Make a Sale
              </h3>
              <p className="text-zinc-500 text-sm mt-2">Search for drugs and add them to the cart to record a new transaction.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                <input
                  type="text"
                  placeholder="Search drugs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredDrugs.map(drug => (
                  <button
                    key={drug.id}
                    disabled={drug.quantity <= 0}
                    onClick={() => addToCart(drug)}
                    className={`p-5 bg-white border border-zinc-200 rounded-2xl text-left hover:border-zinc-900 transition-all group active:scale-95 ${drug.quantity <= 0 ? 'opacity-50 cursor-not-allowed' : 'shadow-sm'}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-bold text-zinc-900 text-lg leading-tight">{drug.name}</span>
                      <span className="text-base font-black text-zinc-900">{formatCurrency(drug.sellingPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${drug.quantity < 10 ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-600'}`}>
                        Stock: {drug.quantity}
                      </span>
                      <div className="p-2 bg-zinc-900 text-white rounded-lg group-hover:bg-zinc-800">
                        <Plus size={20} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-fit sticky top-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <ShoppingCart size={20} />
                Current Order
              </h3>
              <div className="space-y-4 mb-6 max-h-[300px] lg:max-h-[400px] overflow-y-auto pr-2">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart size={40} className="mx-auto text-zinc-200 mb-2" />
                    <p className="text-zinc-400 font-medium">Your cart is empty</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.drug.id} className="flex items-center justify-between gap-4 p-3 bg-zinc-50 rounded-xl">
                      <div className="flex-1">
                        <p className="font-bold text-zinc-900 text-sm">{item.drug.name}</p>
                        <p className="text-xs text-zinc-500">{formatCurrency(item.drug.sellingPrice)} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => removeFromCart(item.drug.id)} className="p-2 bg-white border border-zinc-200 rounded-lg shadow-sm active:bg-zinc-100"><Minus size={16} /></button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateCartQuantity(item.drug.id, parseInt(e.target.value) || 1)}
                          className="w-12 text-center font-black text-base bg-transparent border-none focus:ring-0"
                        />
                        <button onClick={() => addToCart(item.drug)} className="p-2 bg-white border border-zinc-200 rounded-lg shadow-sm active:bg-zinc-100"><Plus size={16} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-zinc-100 pt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Total</span>
                  <span className="text-xl font-bold text-zinc-900">{formatCurrency(cartTotal)}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleCheckout(false)}
                    disabled={cart.length === 0 || isSubmitting}
                    className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Check size={20} />
                        Complete Sale
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setIsDebtModalOpen(true)}
                    disabled={cart.length === 0 || isSubmitting}
                    className="w-full py-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-bold hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    <AlertTriangle size={20} />
                    Record as Debt
                  </button>
                </div>
              </div>
            </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'inventory' && isAdmin && (
          <motion.div 
            key="inventory"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Stock</span>
              <h3 className="text-2xl font-black text-zinc-900 flex items-center gap-2">
                <Package size={28} />
                Current Stock Inventory
              </h3>
              <p className="text-zinc-500 text-sm mt-2">View and verify the quantity of drugs currently available in this shop location.</p>
            </div>

            <div className="space-y-4">
              <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
              <input
                type="text"
                placeholder="Search stock for verification..."
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all shadow-sm"
              />
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
              {/* Desktop Table */}
              <table className="hidden md:table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-bottom border-zinc-200">
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Drug Name</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-center">Current Quantity</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Expiry</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {drugs
                    .filter(d => d.name.toLowerCase().includes(stockSearch.toLowerCase()))
                    .map(drug => {
                      const isExpired = new Date(drug.expiryDate) < new Date();
                      const isLowStock = drug.quantity < (shop?.lowStockLimit || 10);
                      return (
                        <tr key={drug.id} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-zinc-900 text-lg">{drug.name}</td>
                          <td className="px-6 py-4 text-center">
                            {editingDrugId === drug.id ? (
                              <div className="flex items-center justify-center gap-2">
                                <input
                                  type="number"
                                  value={newQuantity}
                                  onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 border border-zinc-300 rounded text-center font-mono"
                                />
                                <button onClick={() => handleUpdateStock(drug.id)} className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm transition-colors">
                                  <Check size={16} />
                                </button>
                                <button onClick={() => setEditingDrugId(null)} className="p-1.5 bg-zinc-100 text-zinc-600 rounded-lg hover:bg-zinc-200 transition-colors">
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-3">
                                <span className="text-2xl font-black text-zinc-900 font-mono">{drug.quantity}</span>
                                <button 
                                  onClick={() => {
                                    setEditingDrugId(drug.id);
                                    setNewQuantity(drug.quantity);
                                  }}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all border border-transparent hover:border-emerald-100"
                                  title="Stock Taking"
                                >
                                  <PlusCircle size={18} />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-zinc-600 font-medium">{formatCurrency(drug.sellingPrice)}</td>
                          <td className="px-6 py-4 text-zinc-600">{drug.expiryDate}</td>
                          <td className="px-6 py-4">
                            {isExpired ? (
                              <span className="px-2 py-1 bg-rose-50 text-rose-600 text-xs font-bold rounded-full">Expired</span>
                            ) : isLowStock ? (
                              <span className="px-2 py-1 bg-amber-50 text-amber-600 text-xs font-bold rounded-full">Low Stock</span>
                            ) : (
                              <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full">Healthy</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-zinc-100">
                {drugs
                  .filter(d => d.name.toLowerCase().includes(stockSearch.toLowerCase()))
                  .map(drug => {
                    const isExpired = new Date(drug.expiryDate) < new Date();
                    const isLowStock = drug.quantity < 10;
                    return (
                      <div key={drug.id} className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-zinc-900 text-lg">{drug.name}</span>
                          {editingDrugId === drug.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={newQuantity}
                                onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
                                className="w-20 px-2 py-1 border border-zinc-300 rounded text-center font-mono"
                              />
                              <button onClick={() => handleUpdateStock(drug.id)} className="p-2 bg-emerald-600 text-white rounded-xl shadow-sm">
                                <Check size={18} />
                              </button>
                              <button onClick={() => setEditingDrugId(null)} className="p-2 bg-zinc-100 text-zinc-600 rounded-xl">
                                <X size={18} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="text-2xl font-black text-zinc-900 font-mono">{drug.quantity}</span>
                              <button 
                                onClick={() => {
                                  setEditingDrugId(drug.id);
                                  setNewQuantity(drug.quantity);
                                }}
                                className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100"
                              >
                                <PlusCircle size={20} />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase">Price & Expiry</p>
                            <p className="font-medium text-zinc-700">{formatCurrency(drug.sellingPrice)} • {drug.expiryDate}</p>
                          </div>
                          {isExpired ? (
                            <span className="px-2 py-1 bg-rose-50 text-rose-600 text-xs font-bold rounded-full">Expired</span>
                          ) : isLowStock ? (
                            <span className="px-2 py-1 bg-amber-50 text-amber-600 text-xs font-bold rounded-full">Low Stock</span>
                          ) : (
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full">Healthy</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div 
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">History</span>
              <h3 className="text-2xl font-black text-zinc-900 flex items-center gap-2">
                <History size={28} />
                Sales History
              </h3>
              <p className="text-zinc-500 text-sm mt-2">Review all past transactions and sales recorded at this specific shop.</p>
            </div>

            <div className="space-y-4">
              {sales.map(sale => (
              <div key={sale.id} className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-zinc-50 rounded-lg text-zinc-400">
                    <History size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-zinc-900">{sale.drugName}</p>
                    <p className="text-xs text-zinc-500">{format(sale.timestamp.toDate(), 'PPpp')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-zinc-900">{formatCurrency(sale.totalPrice)}</p>
                  <p className="text-xs text-zinc-500">Qty: {sale.quantity}</p>
                </div>
              </div>
            ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'orders' && (
          <motion.div 
            key="orders"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Orders</span>
              <h3 className="text-2xl font-black text-zinc-900 flex items-center gap-2">
                <ClipboardList size={28} />
                Place New Order
              </h3>
              <p className="text-zinc-500 text-sm mt-2">Request drugs that are running low in your shop from the main store.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-fit">
                <form onSubmit={handlePlaceOrder} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-zinc-500 mb-1 uppercase tracking-wider">Drug Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter drug name..."
                      value={newOrder.drugName}
                      onChange={(e) => setNewOrder({ ...newOrder, drugName: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-500 mb-1 uppercase tracking-wider">Quantity Needed</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="Enter quantity..."
                      value={newOrder.quantity}
                      onChange={(e) => setNewOrder({ ...newOrder, quantity: e.target.value === '' ? '' : parseInt(e.target.value) })}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-4 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                  >
                    Submit Order Request
                  </button>
                </form>
              </div>

            <div className="space-y-4">
              <h3 className="text-xl font-black flex items-center gap-2">
                <History size={24} className="text-zinc-900" />
                Order History
              </h3>
              <div className="space-y-3">
                {orders.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border border-zinc-200 text-center">
                    <ClipboardList size={48} className="mx-auto text-zinc-100 mb-4" />
                    <p className="text-zinc-400 font-medium">No orders placed yet</p>
                  </div>
                ) : (
                  orders.map(order => (
                    <div key={order.id} className="bg-white p-4 rounded-xl border border-zinc-200 flex justify-between items-center shadow-sm">
                      <div>
                        <p className="font-bold text-zinc-900">{order.drugName}</p>
                        <p className="text-sm text-zinc-500">Qty: {order.quantity}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          order.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          order.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {order.status}
                        </span>
                        <p className="text-[10px] text-zinc-400 mt-1">
                          {order.createdAt?.toDate().toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
        )}

        {activeTab === 'expenses' && (
          <motion.div 
            key="expenses"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Expenses</span>
              <h3 className="text-2xl font-black text-zinc-900 flex items-center gap-2">
                <Receipt size={28} />
                Record Daily Expense
              </h3>
              <p className="text-zinc-500 text-sm mt-2">Track daily costs like cleaning, electricity, or other shop maintenance fees.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-fit">
                <form onSubmit={handleAddExpense} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-zinc-500 mb-1 uppercase tracking-wider">Description</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Cleaning supplies, Electricity..."
                      value={newExpense.description}
                      onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-500 mb-1 uppercase tracking-wider">Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">UGX</span>
                      <input
                        type="number"
                        required
                        step="0.01"
                        placeholder="0.00"
                        value={newExpense.amount || ''}
                        onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })}
                        className="w-full pl-14 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-4 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                  >
                    Save Expense
                  </button>
                </form>
              </div>

            <div className="space-y-4">
              <h3 className="text-xl font-black flex items-center gap-2">
                <History size={24} className="text-zinc-900" />
                Daily Expenses
              </h3>
              <div className="space-y-3">
                {expenses.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border border-zinc-200 text-center">
                    <Receipt size={48} className="mx-auto text-zinc-100 mb-4" />
                    <p className="text-zinc-400 font-medium">No expenses recorded today</p>
                  </div>
                ) : (
                  expenses.map(expense => (
                    <div key={expense.id} className="bg-white p-4 rounded-xl border border-zinc-200 flex justify-between items-center shadow-sm">
                      <div>
                        <p className="font-bold text-zinc-900">{expense.description}</p>
                        <p className="text-xs text-zinc-400">{expense.timestamp?.toDate().toLocaleTimeString()}</p>
                      </div>
                      <p className="font-black text-rose-600">-{formatCurrency(expense.amount)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
        )}

        {activeTab === 'extraSales' && (
          <motion.div 
            key="extraSales"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Extra Sales</span>
              <h3 className="text-2xl font-black text-zinc-900 flex items-center gap-2">
                <Banknote size={28} />
                Record Extra Sale
              </h3>
              <p className="text-zinc-500 text-sm mt-2">Record non-drug income such as consultation fees or other services.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-fit">
                <form onSubmit={handleAddExtraSale} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-zinc-500 mb-1 uppercase tracking-wider">Description</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Consultation fee, Syringe, etc..."
                      value={newExtraSale.description}
                      onChange={(e) => setNewExtraSale({ ...newExtraSale, description: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-500 mb-1 uppercase tracking-wider">Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">UGX</span>
                      <input
                        type="number"
                        required
                        step="0.01"
                        placeholder="0.00"
                        value={newExtraSale.amount || ''}
                        onChange={(e) => setNewExtraSale({ ...newExtraSale, amount: parseFloat(e.target.value) || 0 })}
                        className="w-full pl-14 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-4 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                  >
                    Save Extra Sale
                  </button>
                </form>
              </div>

            <div className="space-y-4">
              <h3 className="text-xl font-black flex items-center gap-2">
                <History size={24} className="text-zinc-900" />
                Extra Sales History
              </h3>
              <div className="space-y-3">
                {extraSales.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border border-zinc-200 text-center">
                    <Banknote size={48} className="mx-auto text-zinc-100 mb-4" />
                    <p className="text-zinc-400 font-medium">No extra sales recorded today</p>
                  </div>
                ) : (
                  extraSales.map(sale => (
                    <div key={sale.id} className="bg-white p-4 rounded-xl border border-zinc-200 flex justify-between items-center shadow-sm">
                      <div>
                        <p className="font-bold text-zinc-900">{sale.description}</p>
                        <p className="text-xs text-zinc-400">{sale.timestamp?.toDate().toLocaleTimeString()}</p>
                      </div>
                      <p className="font-black text-emerald-600">+{formatCurrency(sale.amount)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
        )}

        {activeTab === 'debts' && (
          <motion.div 
            key="debts"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Loans</span>
              <h3 className="text-2xl font-black text-zinc-900 flex items-center gap-2">
                <AlertTriangle size={28} />
                Patient Debts
              </h3>
              <p className="text-zinc-500 text-sm mt-2">Track drugs taken on loan and manage repayments.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {debts.length === 0 ? (
                <div className="col-span-full bg-white p-12 rounded-[2.5rem] border border-zinc-200 text-center">
                  <AlertTriangle size={48} className="mx-auto text-zinc-200 mb-4" />
                  <p className="text-zinc-400 font-medium">No debt records found.</p>
                </div>
              ) : (
                debts.map(debt => {
                  const dueDate = new Date(debt.anticipatedPaymentDate);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const diffTime = dueDate.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  const isOverdue = diffDays < 0 && debt.status === 'unpaid';
                  const isDueToday = diffDays === 0 && debt.status === 'unpaid';

                  return (
                    <div key={debt.id} className={`bg-white p-6 rounded-3xl border ${debt.status === 'paid' ? 'border-emerald-100' : isOverdue ? 'border-rose-200 bg-rose-50/30' : 'border-zinc-200'} shadow-sm relative overflow-hidden`}>
                      {debt.status === 'paid' ? (
                        <div className="absolute top-0 right-0 bg-emerald-500 text-white px-4 py-1 rounded-bl-xl text-[10px] font-black uppercase tracking-widest">
                          Paid
                        </div>
                      ) : isOverdue ? (
                        <div className="absolute top-0 right-0 bg-rose-600 text-white px-4 py-1 rounded-bl-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                          <ShieldAlert size={10} />
                          Overdue
                        </div>
                      ) : isDueToday ? (
                        <div className="absolute top-0 right-0 bg-amber-500 text-white px-4 py-1 rounded-bl-xl text-[10px] font-black uppercase tracking-widest">
                          Due Today
                        </div>
                      ) : null}
                      
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-black text-zinc-900 text-lg">{debt.patientName}</h4>
                          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{debt.drugName} (x{debt.quantity})</p>
                        </div>
                        <span className="text-xl font-black text-zinc-900">{formatCurrency(debt.amount)}</span>
                      </div>
                      
                      <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                          <MessageSquare size={16} className="text-zinc-400" />
                          <span className="font-medium">{debt.patientPhone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                          <Calendar size={16} className="text-zinc-400" />
                          <span>Due: <span className="font-bold text-zinc-900">{format(dueDate, 'MMM dd, yyyy')}</span></span>
                        </div>
                        {debt.status === 'unpaid' && (
                          <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isOverdue ? 'text-rose-600' : diffDays <= 3 ? 'text-amber-600' : 'text-zinc-400'}`}>
                            <AlertCircle size={14} />
                            {isOverdue ? `${Math.abs(diffDays)} days overdue` : isDueToday ? 'Payment due today' : `${diffDays} days remaining`}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                          <History size={16} className="text-zinc-400" />
                          <span>Issued: {format(debt.timestamp.toDate(), 'MMM dd, HH:mm')}</span>
                        </div>
                      </div>

                      {debt.status === 'unpaid' && (
                        <button
                          onClick={() => handleMarkAsPaid(debt)}
                          className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={18} />
                          Mark as Paid
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debt Modal */}
      <AnimatePresence>
        {isDebtModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden border border-zinc-200"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-black text-zinc-900">Record Patient Debt</h3>
                    <p className="text-zinc-500 text-sm mt-1">Please enter patient details for the loan.</p>
                  </div>
                  <button onClick={() => setIsDebtModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl mb-6 flex gap-3">
                  <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                  <p className="text-xs text-amber-800 font-medium leading-relaxed">
                    <span className="font-bold block mb-1 uppercase tracking-wider">Cautionary Note:</span>
                    Personnel are strictly liable for any loans issued. If debts are not repaid by the end of the month, the outstanding amount may be deducted from your salary.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Patient Name</label>
                    <input
                      type="text"
                      value={debtInfo.patientName}
                      onChange={(e) => setDebtInfo({ ...debtInfo, patientName: e.target.value })}
                      placeholder="Enter full name"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Phone Number</label>
                    <input
                      type="tel"
                      value={debtInfo.patientPhone}
                      onChange={(e) => setDebtInfo({ ...debtInfo, patientPhone: e.target.value })}
                      placeholder="e.g. +256..."
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Anticipated Payment Date</label>
                    <input
                      type="date"
                      value={debtInfo.anticipatedDate}
                      onChange={(e) => setDebtInfo({ ...debtInfo, anticipatedDate: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    />
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button
                    onClick={() => setIsDebtModalOpen(false)}
                    className="flex-1 py-3 border border-zinc-200 text-zinc-600 rounded-xl font-bold hover:bg-zinc-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleCheckout(true)}
                    disabled={isSubmitting || !debtInfo.patientName || !debtInfo.patientPhone || !debtInfo.anticipatedDate}
                    className="flex-1 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Check size={20} />
                        Confirm Debt
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) => (
  <button
    onClick={onClick}
    title={label}
    className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-all relative ${active ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'}`}
  >
    <div className="shrink-0">{icon}</div>
    <span className="text-[8px] sm:text-xs font-black uppercase tracking-tighter sm:tracking-normal text-center sm:text-left leading-none sm:leading-normal">
      {label}
    </span>
    {badge !== undefined && badge > 0 && (
      <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-sm border-2 border-zinc-100">
        {badge}
      </span>
    )}
  </button>
);
