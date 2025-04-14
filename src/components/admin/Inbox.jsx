// src/components/admin/Inbox.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    collection, query, where, orderBy, limit, onSnapshot,
    doc, setDoc, addDoc, serverTimestamp, getDoc, updateDoc, Timestamp
} from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { getConversationId } from '../../utils/messagingUtils'; // Adjust path if needed

const Inbox = () => {
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingConversations, setLoadingConversations] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [error, setError] = useState('');
    const currentUser = auth.currentUser;
    const messagesEndRef = useRef(null);
    const location = useLocation();
    const navigate = useNavigate();

    // Effect to handle initial conversation opening AND ensure it exists
    useEffect(() => {
        const handleInitialConversation = async () => {

            console.log("Location state in Inbox:", location.state);
            console.log("Recipient UID:", location.state?.recipientProfile?.uid);

            if (location.state?.activeSection === 'inbox' && location.state?.openConversationId && currentUser) {
                const { openConversationId, recipientProfile } = location.state;
                let stateCleared = false; // Flag to track creation

                console.log("Opening conversation:", openConversationId);
                console.log("Recipient profile:", recipientProfile);

                // --- 1. Prepare Participant Info ---
                const participantInfo = recipientProfile ? {
                    uid: recipientProfile.uid || recipientProfile.id,
                    name: recipientProfile.name || 'Unknown User',
                    photoURL: recipientProfile.profilePictureUrl || ''
                } : null;

                if (!participantInfo?.uid) {
                    console.warn("Recipient profile data incomplete.");
                    setError("Could not load recipient details.");
                    navigate(location.pathname, { replace: true, state: {} });
                    return;
                }

                // --- 2. Check/Create Conversation Document ---
                const conversationRef = doc(db, 'conversations', openConversationId);
                let conversationDataForState = null; // To hold data for optimistic update

                try {
                    const conversationSnap = await getDoc(conversationRef);
                    let finalConversationData; // Data used for state updates

                    if (!conversationSnap.exists()) {
                        // Create it
                        console.log(`Creating conversation ${openConversationId}...`);
                        /* // Profile fetching still commented out */

                         const participantsArray = [currentUser.uid, participantInfo.uid].sort(); // Define explicitly
                         finalConversationData = {
                            participants: [currentUser.uid, participantInfo.uid].sort(),
                            participantInfo: {
                                [currentUser.uid]: {
                                    name: currentUser.displayName || 'Current User',
                                    photoURL: currentUser.photoURL || ''
                                },
                                [participantInfo.uid]: {
                                    name: participantInfo.name,
                                    photoURL: participantInfo.photoURL
                                }
                            },
                            lastMessageTimestamp: serverTimestamp(), // Include server timestamp
                            lastMessageText: '',                    // Include empty text
                            createdAt: serverTimestamp()           // Include server timestamp
                        };

                         // ---> START: Add these console logs <---
                         console.log("--- Debugging Create ---");
                         console.log("Current User UID:", currentUser.uid);
                         console.log("Recipient UID:", participantInfo.uid);
                         console.log("Participants Array to Write:", participantsArray);
                         const calculatedId = participantsArray.join('_');
                         console.log("Client Calculated ID:", calculatedId);
                         console.log("Conversation Ref Path ID:", conversationRef.id); // conversationRef was defined earlier as doc(db, 'conversations', openConversationId)
                         console.log("Data being sent:", JSON.stringify(finalConversationData)); // Log the exact object
                         console.log("--- End Debugging Create ---");
                         // ---> END: Add these console logs <---

                        // Attempt to write only the participants array
                        await setDoc(conversationRef, finalConversationData); // This is the line failing
                        console.log(`Conversation ${openConversationId} created.`);
                    } else {
                         // ...
                    }

                     // Prepare the object for state updates (use client-side date for optimistic timestamp)
                    //  conversationDataForState = {
                    //      id: openConversationId,
                    //      ...finalConversationData,
                    //      // Convert server timestamps placeholders/actual to JS Dates for immediate state use
                    //      lastMessageTimestamp: finalConversationData.lastMessageTimestamp instanceof Timestamp
                    //         ? finalConversationData.lastMessageTimestamp
                    //         : new Timestamp(Math.floor(Date.now()/1000), 0), // Use current time if serverTimestamp was placeholder
                    //      createdAt: finalConversationData.createdAt instanceof Timestamp
                    //         ? finalConversationData.createdAt
                    //         : new Timestamp(Math.floor(Date.now()/1000), 0), // Use current time if serverTimestamp was placeholder
                    //       // Construct the 'otherParticipant' object needed for rendering/selection
                    //      otherParticipant: {
                    //          uid: participantInfo.uid,
                    //          name: participantInfo.name,
                    //          photoURL: participantInfo.photoURL
                    //      }
                    //  };


                    // // --- 3. Optimistic UI Update for Conversation List ---
                    // // Add/Update the conversation in the local list immediately
                    // setConversations(prev => {
                    //     const existsInList = prev.some(conv => conv.id === openConversationId);
                    //     if (!existsInList) {
                    //         // Add the new conversation, maintaining sort order (or simply prepend/append)
                    //          // Prepend for most recent based on creation attempt time
                    //         return [conversationDataForState, ...prev].sort((a, b) => {
                    //             const timeA = a.lastMessageTimestamp?.seconds ?? 0;
                    //             const timeB = b.lastMessageTimestamp?.seconds ?? 0;
                    //             return timeB - timeA; // Descending order
                    //         });
                    //     } else {
                    //          // If it somehow exists (e.g., fast snapshot), update it
                    //          return prev.map(conv => conv.id === openConversationId ? conversationDataForState : conv);
                    //     }
                    // });


                    // --- 4. Set Selected Conversation ---
                    setSelectedConversation({
                        id: openConversationId,
                        otherParticipant: { uid: participantInfo.uid, name: participantInfo.name, photoURL: participantInfo.photoURL }
                    });

                    // --- 5. Clear State *AFTER* successful processing --- <<<< MOVED HERE
                    navigate(location.pathname, { replace: true, state: {} });
                    stateCleared = true; // Mark state as cleared
                    console.log("Navigation state cleared successfully after processing.");


                } catch (err) {
                    console.error("Error handling initial conversation:", err);
                    setError("Failed to initialize the conversation.");
                } finally {
                    // --- Ensure state is cleared if an error occurred before step 5 ---
                    if (!stateCleared) {
                         // Only clear here if it wasn't cleared in the try block
                         // This handles errors during async operations before step 5
                         console.log("Clearing navigation state in finally block (error occurred).");
                         navigate(location.pathname, { replace: true, state: {} });
                    }
                }
            } else if (location.state?.activeSection === 'inbox') {
                // If we were directed to inbox but lacked data, clear the state anyway
                 console.log("Clearing navigation state (incomplete data).");
                 navigate(location.pathname, { replace: true, state: {} });
            }
        };

        handleInitialConversation();
        // Dependencies remain the same
    }, [location.state, navigate, currentUser]);


    // Fetch conversations (onSnapshot listener) - Listens for real-time changes
    useEffect(() => {
        if (!currentUser) {
            setLoadingConversations(false);
            setConversations([]);
            return () => {};
        }
        setLoadingConversations(true);
        setError('');
        const convQuery = query(
             collection(db, 'conversations'),
            where('participants', 'array-contains', currentUser.uid),
            orderBy('lastMessageTimestamp', 'desc')
        );
        const unsubscribe = onSnapshot(convQuery, async (querySnapshot) => {
            const convList = [];
            const profilePromises = [];

            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const otherUid = data.participants?.find(uid => uid !== currentUser.uid);
                 if (!otherUid) return; // Skip if data is incomplete

                let participantInfo = data.participantInfo?.[otherUid];
                let needsFetching = false;

                if (!participantInfo) {
                    needsFetching = true;
                    profilePromises.push(
                         getDoc(doc(db, 'profiles', otherUid)).then(profileSnap => ({
                            convId: docSnap.id, otherUid: otherUid,
                            profileData: profileSnap.exists() ? profileSnap.data() : null
                        }))
                    );
                }

                 // Ensure Timestamps are handled correctly
                 const lastMsgTs = data.lastMessageTimestamp instanceof Timestamp ? data.lastMessageTimestamp : null;
                 const createdTs = data.createdAt instanceof Timestamp ? data.createdAt : null;

                convList.push({
                    id: docSnap.id,
                    ...data,
                     lastMessageTimestamp: lastMsgTs, // Store as Timestamp or null
                     createdAt: createdTs, // Store as Timestamp or null
                    otherParticipant: participantInfo ?
                        { uid: otherUid, name: participantInfo.name, photoURL: participantInfo.photoURL } :
                        { uid: otherUid, name: 'Loading...', photoURL: '', needsFetching: true }
                });
            });

             if (profilePromises.length > 0) {
                 try {
                     const profileResults = await Promise.all(profilePromises);
                     profileResults.forEach(result => {
                         const convIndex = convList.findIndex(c => c.id === result.convId);
                         if (convIndex !== -1) {
                            convList[convIndex].otherParticipant = {
                                uid: result.otherUid,
                                name: result.profileData?.name || 'Unknown User',
                                photoURL: result.profileData?.profilePictureUrl || '',
                                needsFetching: false
                            };
                        }
                     });
                 } catch (profileFetchError) { console.error("Error fetching profiles:", profileFetchError); }
            }
            // Set the state with the latest data from Firestore
            // This will naturally overwrite the optimistic update eventually
            setConversations(convList);
            setLoadingConversations(false);
        }, (err) => {
            console.error("Error fetching conversations:", err);
            setError("Failed to load conversations.");
            setLoadingConversations(false);
        });
        return () => unsubscribe(); // Clean up listener
    }, [currentUser]);


    // Fetch messages when selectedConversation changes
    useEffect(() => {
         if (!selectedConversation?.id) { // Check for ID
            setMessages([]);
            setLoadingMessages(false);
            return () => {};
         }
        setLoadingMessages(true);
        setError('');
        const messagesQuery = query(
            collection(db, 'conversations', selectedConversation.id, 'messages'),
            orderBy('timestamp', 'asc') // Oldest first
        );
        const unsubscribe = onSnapshot(messagesQuery, (querySnapshot) => {
            const msgList = querySnapshot.docs.map(docSnap => {
                 const data = docSnap.data();
                 // Convert Timestamp to JS Date for rendering
                 const jsDate = data.timestamp instanceof Timestamp
                                 ? data.timestamp.toDate()
                                 : (data.timestamp ? new Date(data.timestamp) : new Date()); // Fallback needed?
                return { id: docSnap.id, ...data, timestamp: jsDate };
            });
            setMessages(msgList);
            setLoadingMessages(false);
        }, (err) => {
            console.error(`Error fetching messages for ${selectedConversation.id}:`, err);
            setError(`Failed to load messages.`);
            setLoadingMessages(false);
        });
        return () => unsubscribe(); // Clean up message listener
    }, [selectedConversation]); // Re-run ONLY when selection changes


    // Scroll effect for messages
    useEffect(() => {
        const timer = setTimeout(() => {
             messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100); // Slight delay
       return () => clearTimeout(timer);
    }, [messages]); // Run when messages change


    // handleSelectConversation - Selects conversation from the list
    const handleSelectConversation = useCallback((conversation) => {
         if (selectedConversation?.id === conversation.id) return; // Avoid re-selection

          // Fetch profile if needed (marked as needsFetching)
          if (conversation.otherParticipant?.needsFetching && conversation.otherParticipant?.uid) {
              setLoadingMessages(true); // Optional: indicate loading
              getDoc(doc(db, 'profiles', conversation.otherParticipant.uid))
                .then(profileSnap => {
                    const profileData = profileSnap.exists() ? profileSnap.data() : {};
                     setSelectedConversation({
                         id: conversation.id,
                         otherParticipant: {
                            uid: conversation.otherParticipant.uid,
                            name: profileData.name || 'Unknown User',
                            photoURL: profileData.profilePictureUrl || '',
                         }
                    });
                })
                .catch(err => {
                     console.error("Error fetching profile on selection:", err);
                     setSelectedConversation({ // Fallback
                          id: conversation.id,
                          otherParticipant: { uid: conversation.otherParticipant.uid, name: 'Unknown User', photoURL: '', }
                     });
                })
                .finally(() => setLoadingMessages(false));
         } else if (conversation.otherParticipant?.uid) {
              // Use existing data if available and no fetching needed
              setSelectedConversation({ id: conversation.id, otherParticipant: conversation.otherParticipant });
         } else {
             console.error("Cannot select conversation, missing UID.", conversation);
             setError("Error selecting conversation.");
         }
    }, [selectedConversation?.id]); // Dependency ensures stability


    // handleSendMessage - Sends a new message
    const handleSendMessage = async (e) => {
         e.preventDefault();
        const messageText = newMessage.trim();
         // Validation
         if (!messageText || !currentUser || !selectedConversation?.id || !selectedConversation.otherParticipant?.uid) {
            setError("Cannot send message."); return;
         }
         setError('');
         setNewMessage(''); // Clear input

         // Prepare refs and data
         const conversationRef = doc(db, 'conversations', selectedConversation.id);
         const messagesColRef = collection(conversationRef, 'messages');
         const messageData = {
             senderUid: currentUser.uid,
             receiverUid: selectedConversation.otherParticipant.uid,
             text: messageText,
             timestamp: serverTimestamp(), // Use server time
             isRead: false,
         };
         const conversationUpdateData = {
             lastMessageText: messageText.length > 50 ? messageText.substring(0, 47) + '...' : messageText,
             lastMessageTimestamp: serverTimestamp(), // Use server time
         };

         try {
             // Add message and update conversation metadata
             // Consider using a batch write for atomicity in production
             await addDoc(messagesColRef, messageData);
             await updateDoc(conversationRef, conversationUpdateData);
             console.log("Message sent!");
             messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); // Scroll after sending
         } catch (err) {
             console.error("Error sending message:", err);
             setError(`Failed to send message: ${err.message}`);
             setNewMessage(messageText); // Restore message on error
         }
    };


    // formatTimestamp - Helper for displaying time
    const formatTimestamp = (ts) => { // Expects a Firestore Timestamp object
        if (!ts || !(ts instanceof Timestamp)) return '...';
        const date = ts.toDate(); // Convert to JS Date
        // Format as needed, e.g., just time
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };


    // --- JSX Rendering ---
    return (
        <div className="w-full h-full flex border border-base-300 rounded-lg overflow-hidden bg-base-100">

            {/* Conversation List Sidebar */}
            <div className="w-1/3 border-r border-base-300 flex flex-col bg-base-200/50">
                <h2 className="text-lg font-semibold p-3 border-b border-base-300 flex-shrink-0 text-center">
                    Inbox
                </h2>
                <div className="overflow-y-auto flex-grow">
                    {loadingConversations ? (
                        <div className="p-4 text-center"><span className="loading loading-dots loading-md"></span></div>
                    ) : conversations.length === 0 ? (
                         <p className="p-4 text-sm text-base-content/70 text-center italic">No conversations yet.</p>
                    ) : (
                        <ul>
                            {conversations.map(conv => (
                                <li key={conv.id}
                                    // Apply highlight if selected
                                    className={`block border-b border-base-300 cursor-pointer transition duration-150 ease-in-out ${selectedConversation?.id === conv.id ? 'bg-primary/20' : 'hover:bg-base-300/70'}`}
                                    onClick={() => handleSelectConversation(conv)}
                                >
                                     {/* Check if participant data is loaded */}
                                     {conv.otherParticipant ? (
                                         <div className="flex items-center gap-3 p-3">
                                            {/* Avatar */}
                                            <div className="avatar flex-shrink-0">
                                                <div className="w-10 rounded-full ring ring-primary/50 ring-offset-base-100 ring-offset-1">
                                                    <img src={conv.otherParticipant?.photoURL || "https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"} alt={conv.otherParticipant?.name || 'User'} />
                                                </div>
                                            </div>
                                            {/* Name & Last Message */}
                                            <div className="flex-grow overflow-hidden">
                                                <p className="font-medium text-sm truncate">{conv.otherParticipant?.name || 'Loading...'}</p>
                                                <p className="text-xs text-base-content/60 truncate mt-1">{conv.lastMessageText || '...'}</p>
                                            </div>
                                            {/* Timestamp */}
                                            <span className="text-xs text-base-content/50 flex-shrink-0 ml-1 self-start pt-1">
                                                {/* Format the stored Timestamp object */}
                                                {formatTimestamp(conv.lastMessageTimestamp)}
                                            </span>
                                         </div>
                                     ) : (
                                         <div className="p-3 text-xs text-error">Error loading participant</div>
                                     )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                 {/* General Error Display (Sidebar) */}
                 {error && !error.includes('message') && <p className="p-2 text-xs text-error text-center flex-shrink-0 border-t border-base-300">{error}</p>}
            </div>

            {/* Message View Area */}
            <div className="w-2/3 flex flex-col bg-base-100">
                {selectedConversation ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-3 border-b border-base-300 flex items-center gap-3 flex-shrink-0 bg-base-200/30">
                           <div className="avatar">
                               <div className="w-8 rounded-full">
                                   <img src={selectedConversation.otherParticipant?.photoURL || "https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"} alt={selectedConversation.otherParticipant?.name} />
                               </div>
                           </div>
                           <p className="font-semibold">{selectedConversation.otherParticipant?.name || '...'}</p>
                        </div>

                        {/* Messages Container */}
                        <div className="flex-grow overflow-y-auto p-4 space-y-4">
                            {loadingMessages ? (
                                 <div className="flex justify-center items-center h-full"><span className="loading loading-dots loading-lg"></span></div>
                            ) : messages.length === 0 ? (
                                 <p className="text-center text-base-content/60 italic mt-10">No messages in this conversation yet.</p>
                            ) : (
                                messages.map(msg => (
                                    <div key={msg.id} className={`chat ${msg.senderUid === currentUser?.uid ? 'chat-end' : 'chat-start'}`}>
                                        <div className={`chat-bubble text-sm md:text-base ${msg.senderUid === currentUser?.uid ? 'chat-bubble-primary' : 'chat-bubble-secondary'}`}>
                                            {msg.text}
                                            <time className="text-xs opacity-60 block mt-1 text-right">
                                                 {/* Format timestamp from JS Date object */}
                                                 {msg.timestamp instanceof Date ? msg.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '...'}
                                            </time>
                                        </div>
                                    </div>
                                ))
                            )}
                            {/* Scroll anchor */}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message Input Form */}
                         <form onSubmit={handleSendMessage} className="p-3 border-t border-base-300 flex gap-2 flex-shrink-0 bg-base-200/30">
                            <input
                                type="text"
                                placeholder="Type your message..."
                                className="input input-bordered input-sm flex-grow"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                disabled={!currentUser || loadingMessages || !selectedConversation}
                                aria-label="New message input"
                            />
                            <button
                                type="submit"
                                className="btn btn-primary btn-sm"
                                disabled={!newMessage.trim() || !currentUser || loadingMessages || !selectedConversation}
                                aria-label="Send message"
                            >
                                Send
                                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4 ml-1">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                                 </svg>
                            </button>
                         </form>
                         {/* Message Area Error Display */}
                         {error && error.includes('message') && <p className="p-2 text-xs text-error text-center flex-shrink-0">{error}</p>}
                    </>
                ) : (
                    // Placeholder when no conversation is selected
                    <div className="flex items-center justify-center h-full">
                        <p className="text-base-content/60">Select a conversation to view messages.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Inbox;