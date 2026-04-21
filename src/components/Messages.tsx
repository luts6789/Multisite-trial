import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where, orderBy, addDoc, Timestamp, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Message, UserProfile, Shop } from '../types';
import { format } from 'date-fns';
import { MessageSquare, Send, User, Store, Check, CheckCheck, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MessagesProps {
  userProfile: UserProfile;
}

export const Messages: React.FC<MessagesProps> = ({ userProfile }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [shops, setShops] = useState<Shop[]>([]);
  const [personnel, setPersonnel] = useState<UserProfile[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<{ id: string; name: string; shopId?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isAdmin = userProfile.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      // Fetch shops and personnel for admin to choose from
      const unsubShops = onSnapshot(collection(db, 'shops'), (snapshot) => {
        setShops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop)));
      });

      const unsubPersonnel = onSnapshot(query(collection(db, 'users'), where('role', '==', 'personnel')), (snapshot) => {
        const allPersonnel = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
        
        // Group by email to handle the UID vs Email-slug ID transition
        const uniquePersonnel: { [email: string]: UserProfile } = {};
        allPersonnel.forEach(p => {
          const email = p.email.toLowerCase();
          // Prefer UID-based ID (usually 28 chars) over email-slug ID
          if (!uniquePersonnel[email] || p.id.length > uniquePersonnel[email].id.length) {
            uniquePersonnel[email] = p;
          }
        });
        
        setPersonnel(Object.values(uniquePersonnel));
      });

      setLoading(false);
      return () => {
        unsubShops();
        unsubPersonnel();
      };
    } else {
      // Personnel only chats with admin
      setSelectedRecipient({ id: 'admin', name: 'Administrator' });
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedRecipient && isAdmin) return;

    const recipientId = isAdmin ? selectedRecipient?.id : 'admin';
    const currentShopId = isAdmin ? (selectedRecipient?.shopId || 'global') : (userProfile.shopId || 'global');
    
    // Query messages where user is sender or receiver
    // For personnel, they see messages for their shop or addressed to them
    // For simplicity, let's use shopId as the main filter for personnel
    
    let q;
    if (isAdmin) {
      if (selectedRecipient?.id === 'admin') return; // Should not happen
      
      // Admin sees messages for the selected recipient/shop
      q = query(
        collection(db, 'messages'),
        where('shopId', '==', currentShopId),
        orderBy('timestamp', 'asc')
      );
    } else {
      // Personnel sees messages for their shop
      q = query(
        collection(db, 'messages'),
        where('shopId', '==', currentShopId),
        orderBy('timestamp', 'asc')
      );
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      
      // Mark received messages as read
      msgs.forEach(async (msg) => {
        if (!msg.read && msg.senderId !== userProfile.id) {
          await updateDoc(doc(db, 'messages', msg.id), { read: true });
        }
      });
    });

    return () => unsub();
  }, [selectedRecipient, isAdmin, userProfile.id, userProfile.shopId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || (!selectedRecipient && isAdmin)) return;

    try {
      const currentShopId = isAdmin ? (selectedRecipient?.shopId || 'global') : (userProfile.shopId || 'global');
      const messageData = {
        shopId: currentShopId,
        senderId: userProfile.id,
        senderName: isAdmin ? 'Admin' : (userProfile.email.split('@')[0]),
        receiverId: isAdmin ? selectedRecipient?.id : 'admin',
        content: newMessage.trim(),
        timestamp: Timestamp.now(),
        read: false
      };

      await addDoc(collection(db, 'messages'), messageData);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col lg:flex-row gap-6">
      {/* Sidebar for Admin */}
      {isAdmin && (
        <div className={`lg:w-80 bg-white rounded-[2rem] border border-zinc-200 flex flex-col overflow-hidden ${selectedRecipient ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-6 border-b border-zinc-100">
            <h3 className="text-xl font-black text-zinc-900 flex items-center gap-2">
              <MessageSquare size={24} />
              Chats
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {personnel.map(p => {
              const shop = shops.find(s => s.id === p.shopId);
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedRecipient({ id: p.id, name: p.email.split('@')[0], shopId: p.shopId })}
                  className={`w-full p-4 rounded-2xl flex items-center gap-3 transition-all ${
                    selectedRecipient?.id === p.id ? 'bg-zinc-900 text-white shadow-lg' : 'hover:bg-zinc-50 text-zinc-600'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${selectedRecipient?.id === p.id ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                    <User size={20} />
                  </div>
                  <div className="text-left overflow-hidden">
                    <p className="font-bold truncate">{p.email.split('@')[0]}</p>
                    <p className={`text-[10px] uppercase tracking-widest font-bold truncate ${selectedRecipient?.id === p.id ? 'text-zinc-400' : 'text-zinc-400'}`}>
                      {shop?.name || 'No Shop'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className={`flex-1 bg-white rounded-[2rem] border border-zinc-200 flex flex-col overflow-hidden ${isAdmin && !selectedRecipient ? 'hidden lg:flex items-center justify-center' : 'flex'}`}>
        {!selectedRecipient && isAdmin ? (
          <div className="text-center p-12">
            <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageSquare size={40} className="text-zinc-200" />
            </div>
            <h3 className="text-2xl font-black text-zinc-900 mb-2">Select a Chat</h3>
            <p className="text-zinc-500">Choose a personnel member to start communicating.</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                {isAdmin && (
                  <button 
                    onClick={() => setSelectedRecipient(null)}
                    className="lg:hidden p-2 hover:bg-zinc-100 rounded-full"
                  >
                    <ChevronLeft size={24} />
                  </button>
                )}
                <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center shadow-md">
                  {isAdmin ? <User className="text-white" size={24} /> : <Store className="text-white" size={24} />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-zinc-900">{selectedRecipient?.name}</h3>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    {isAdmin ? (shops.find(s => s.id === selectedRecipient?.shopId)?.name || 'Personnel') : 'Administrator'}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages List */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/30"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-12">
                  <p className="text-zinc-400 font-medium">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.senderId === userProfile.id;
                  const showDate = index === 0 || 
                    format(messages[index-1].timestamp.toDate(), 'yyyy-MM-dd') !== format(msg.timestamp.toDate(), 'yyyy-MM-dd');

                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center my-6">
                          <span className="px-3 py-1 bg-zinc-200 text-zinc-500 text-[10px] font-bold rounded-full uppercase tracking-wider">
                            {format(msg.timestamp.toDate(), 'MMMM dd, yyyy')}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] lg:max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                            isMe ? 'bg-zinc-900 text-white rounded-tr-none' : 'bg-white border border-zinc-200 text-zinc-900 rounded-tl-none'
                          }`}>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          <div className="flex items-center gap-1.5 px-1">
                            <span className="text-[10px] font-bold text-zinc-400">
                              {format(msg.timestamp.toDate(), 'HH:mm')}
                            </span>
                            {isMe && (
                              msg.read ? <CheckCheck size={12} className="text-emerald-500" /> : <Check size={12} className="text-zinc-300" />
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
            </div>

            {/* Message Input */}
            <div className="p-6 bg-white border-t border-zinc-100">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-medium"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-4 bg-zinc-900 text-white rounded-2xl hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-zinc-200"
                >
                  <Send size={24} />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
