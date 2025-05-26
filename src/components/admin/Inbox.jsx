// src/components/admin/Inbox.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    collection, query, where, orderBy, limit, onSnapshot,
    doc, setDoc, addDoc, serverTimestamp, getDoc, updateDoc, Timestamp
} from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { getConversationId } from '../../utils/messagingUtils'; // Adjust path if needed

// --- Back Icon SVG ---
const BackIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
);

// Default Avatar (if needed, or use existing user icon logic)
const DefaultAvatar = ({ className = "w-8 h-8" }) => (
    <div className={`${className} rounded-full bg-base-300 flex items-center justify-center`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
    </div>
);


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

    // --- NEW STATE: Manage view mode for mobile ---
    const [mobileView, setMobileView] = useState('list'); // 'list' or 'conversation'

    // --- Effect to handle initial conversation opening (MODIFIED) ---
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
                let finalConversationData; // Store the data whether created or fetched

                try {
                    const conversationSnap = await getDoc(conversationRef);

                    if (!conversationSnap.exists()) {
                        // Create it
                        console.log(`Creating conversation ${openConversationId}...`);
                         const participantsArray = [currentUser.uid, participantInfo.uid].sort();
                         finalConversationData = { // Assign to the outer variable
                            participants: participantsArray,
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
                            lastMessageTimestamp: serverTimestamp(),
                            lastMessageText: '',
                            createdAt: serverTimestamp()
                        };
                        await setDoc(conversationRef, finalConversationData);
                        console.log(`Conversation ${openConversationId} created.`);
                    } else {
                        finalConversationData = conversationSnap.data(); // Use existing data
                         console.log(`Conversation ${openConversationId} exists.`);
                    }

                     // --- Prepare state data including otherParticipant ---
                     // Ensure we use the correct participant info structure
                     const otherParticipantData = finalConversationData.participantInfo?.[participantInfo.uid] || {
                         name: participantInfo.name, // Fallback to passed-in info
                         photoURL: participantInfo.photoURL
                     };

                     console.log("Other participant data for state:", otherParticipantData);


                    // --- 3. Set Selected Conversation AND Mobile View ---
                    setSelectedConversation({
                        id: openConversationId,
                        otherParticipant: {
                            uid: participantInfo.uid, // Crucial: Ensure UID is set correctly
                            name: otherParticipantData.name,
                            photoURL: otherParticipantData.photoURL
                        }
                    });
                    setMobileView('conversation'); // <<<--- SET VIEW TO CONVERSATION ON MOBILE
                    // ------------------------------------------------

                    // --- 4. Clear State *AFTER* successful processing ---
                    navigate(location.pathname, { replace: true, state: {} });
                    stateCleared = true; // Mark state as cleared
                    console.log("Navigation state cleared successfully after processing.");


                } catch (err) {
                    console.error("Error handling initial conversation:", err);
                    setError("Failed to initialize the conversation.");
                } finally {
                    // --- Ensure state is cleared if an error occurred before step 4 ---
                    if (!stateCleared) {
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


    // Fetch conversations (onSnapshot listener)
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
            const profilePromises = []; // To fetch missing profiles

            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const otherUid = data.participants?.find(uid => uid !== currentUser.uid);
                 if (!otherUid) {
                      console.warn(`Conversation ${docSnap.id} missing other participant.`);
                      return; // Skip incomplete conversation data
                 }

                let participantInfo = data.participantInfo?.[otherUid];
                let needsFetching = false;

                // Check if info exists and is valid
                if (!participantInfo || !participantInfo.name) {
                    console.log(`Profile info missing or incomplete for UID ${otherUid} in conv ${docSnap.id}. Marking for fetch.`);
                    needsFetching = true;
                    profilePromises.push(
                         getDoc(doc(db, 'profiles', otherUid)).then(profileSnap => ({
                            convId: docSnap.id, otherUid: otherUid,
                            profileData: profileSnap.exists() ? profileSnap.data() : null
                        })).catch(err => {
                             console.error(`Failed to fetch profile for UID ${otherUid}:`, err);
                             return { convId: docSnap.id, otherUid: otherUid, profileData: null }; // Return null data on error
                        })
                    );
                     // Prepare a placeholder structure
                     participantInfo = { uid: otherUid, name: 'Loading...', photoURL: '', needsFetching: true };
                } else {
                     // Ensure the structure includes UID even if fetched from participantInfo
                     participantInfo = { uid: otherUid, ...participantInfo, needsFetching: false };
                }

                 const lastMsgTs = data.lastMessageTimestamp instanceof Timestamp ? data.lastMessageTimestamp : null;
                 const createdTs = data.createdAt instanceof Timestamp ? data.createdAt : null;

                convList.push({
                    id: docSnap.id,
                    ...data, // Spread the rest of the conversation data
                     lastMessageTimestamp: lastMsgTs,
                     createdAt: createdTs,
                    // Use the prepared participantInfo object (placeholder or existing)
                    otherParticipant: participantInfo
                });
            });

             // Fetch profiles if any were marked
             if (profilePromises.length > 0) {
                 console.log(`Workspaceing ${profilePromises.length} missing profiles...`);
                 try {
                     const profileResults = await Promise.all(profilePromises);
                     profileResults.forEach(result => {
                         const convIndex = convList.findIndex(c => c.id === result.convId);
                         if (convIndex !== -1) {
                            const profileData = result.profileData;
                            convList[convIndex].otherParticipant = {
                                uid: result.otherUid, // Ensure UID is always present
                                name: profileData?.name || 'Unknown User',
                                photoURL: profileData?.profilePictureUrl || '',
                                needsFetching: false // Mark as fetched (even if not found)
                            };
                        }
                     });
                 } catch (profileFetchError) {
                     console.error("Error fetching profiles in batch:", profileFetchError);
                     // Handle error - maybe leave placeholders as 'Loading...' or set to 'Error'
                 }
            }

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
         if (!selectedConversation?.id) {
            setMessages([]);
            setLoadingMessages(false);
            return () => {};
         }
        setLoadingMessages(true);
        setError('');
        const messagesQuery = query(
            collection(db, 'conversations', selectedConversation.id, 'messages'),
            orderBy('timestamp', 'asc')
        );
        const unsubscribe = onSnapshot(messagesQuery, (querySnapshot) => {
            const msgList = querySnapshot.docs.map(docSnap => {
                 const data = docSnap.data();
                 const jsDate = data.timestamp instanceof Timestamp
                                 ? data.timestamp.toDate()
                                 : (data.timestamp ? new Date(data.timestamp.seconds * 1000) : new Date()); // Handle Firestore Timestamp object
                return { id: docSnap.id, ...data, timestamp: jsDate };
            });
            setMessages(msgList);
            setLoadingMessages(false);
        }, (err) => {
            console.error(`Error fetching messages for ${selectedConversation.id}:`, err);
            setError(`Failed to load messages.`);
            setLoadingMessages(false);
        });
        return () => unsubscribe();
    }, [selectedConversation]);


    // Scroll effect for messages
    useEffect(() => {
        const timer = setTimeout(() => {
             messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
       return () => clearTimeout(timer);
    }, [messages]);


    // --- handleSelectConversation (MODIFIED for mobile view switch) ---
    const handleSelectConversation = useCallback((conversation) => {
        // Avoid re-selecting if already viewing THIS conversation on mobile
        if (selectedConversation?.id === conversation.id && mobileView === 'conversation') {
             console.log("Conversation already selected and viewed.");
             return;
        }

        console.log("Selecting conversation:", conversation);

        const processSelection = (profileData) => {
            const otherPData = profileData || {}; // Use empty object as fallback
             console.log("Processing selection with profile data:", otherPData);
            setSelectedConversation({
                id: conversation.id,
                otherParticipant: {
                    uid: conversation.otherParticipant.uid, // Use UID from conversation object
                    name: otherPData.name || 'Unknown User', // Use fetched/existing name
                    photoURL: otherPData.profilePictureUrl || otherPData.photoURL || '', // Use fetched/existing photo
                }
            });
            setMobileView('conversation'); // <<<--- SWITCH VIEW ON MOBILE
             console.log("Mobile view set to 'conversation'");
        };

        // Check if participant data is valid and needs fetching
        if (!conversation.otherParticipant || !conversation.otherParticipant.uid) {
             console.error("Cannot select conversation, missing otherParticipant data or UID.", conversation);
             setError("Error selecting conversation details.");
             return;
        }


        if (conversation.otherParticipant.needsFetching) {
             console.log(`Needs fetching profile for UID: ${conversation.otherParticipant.uid}`);
            setLoadingMessages(true); // Show loading indicator while fetching profile
            getDoc(doc(db, 'profiles', conversation.otherParticipant.uid))
              .then(profileSnap => {
                  console.log(`Profile fetched for ${conversation.otherParticipant.uid}, exists: ${profileSnap.exists()}`);
                  processSelection(profileSnap.exists() ? profileSnap.data() : null);
              })
              .catch(err => {
                   console.error("Error fetching profile on selection:", err);
                   processSelection(null); // Process with fallback data on error
              })
              .finally(() => setLoadingMessages(false));
        } else {
             console.log("Using existing profile data for selection.");
             // Use existing profile data directly (passed within conversation object)
             processSelection(conversation.otherParticipant);
        }
    }, [selectedConversation?.id, mobileView]); // Add mobileView dependency


    // Handle Sending Message
    const handleSendMessage = async (e) => {
         e.preventDefault();
        const messageText = newMessage.trim();
         if (!messageText || !currentUser || !selectedConversation?.id || !selectedConversation.otherParticipant?.uid) {
            setError("Cannot send message. Missing user, selection, or recipient ID.");
             console.error("Send Message Aborted: Missing required data", {currentUser, selectedConversation});
            return;
         }
         setError('');
         setNewMessage('');

         const conversationRef = doc(db, 'conversations', selectedConversation.id);
         const messagesColRef = collection(conversationRef, 'messages');
         const messageData = {
             senderUid: currentUser.uid,
             receiverUid: selectedConversation.otherParticipant.uid,
             text: messageText,
             timestamp: serverTimestamp(),
             isRead: false,
         };
         const conversationUpdateData = {
             lastMessageText: messageText.length > 50 ? messageText.substring(0, 47) + '...' : messageText,
             lastMessageTimestamp: serverTimestamp(),
             // Update participantInfo minimally if needed, e.g., read status per participant
         };

         try {
             await addDoc(messagesColRef, messageData);
             await updateDoc(conversationRef, conversationUpdateData);
             console.log("Message sent!");
             // Optionally scroll immediately
             // messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
         } catch (err) {
             console.error("Error sending message:", err);
             setError(`Failed to send message: ${err.message}`);
             setNewMessage(messageText); // Restore message input on error
         }
    };


    // Format Timestamp Helper
    const formatTimestamp = (ts) => {
        if (!ts || !(ts instanceof Timestamp)) return '...';
        const date = ts.toDate();
        // Example: return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
         return date.toLocaleDateString([], { month: 'short', day: 'numeric' }); // Or just date
    };

    // --- NEW: Handle Back Button Click on Mobile ---
    const handleGoBackToList = () => {
        setMobileView('list');
        setSelectedConversation(null); // Clear selection when going back to list view
         console.log("Mobile view set back to 'list'");
    }

    // --- JSX Rendering (MODIFIED) ---
    return (
        // Use flex layout only on medium screens and up
        // Ensure parent container allows height: e.g., h-full or specific height
        <div className="w-full h-full mt-12 md:mt-0 md:flex border border-base-300 rounded-lg overflow-hidden bg-base-100">

            {/* Conversation List Sidebar */}
            {/* --- MODIFIED: Conditional display based on screen size and mobileView state --- */}
            <div className={`
                ${mobileView === 'list' ? 'block' : 'hidden'} md:block
                w-full md:w-1/3 border-r border-base-300 flex flex-col bg-base-200/50 h-full
            `}>
                <h2 className="text-lg font-semibold p-3 border-b border-base-300 flex-shrink-0 text-center sticky top-0 md:bg-base-200/80 backdrop-blur-sm z-10">
                    Inbox
                </h2>
                {/* Make the list scrollable */}
                <div className="overflow-y-auto flex-grow">
                    {loadingConversations ? (
                        <div className="p-4 text-center pt-10"><span className="loading loading-dots loading-md"></span></div>
                    ) : conversations.length === 0 ? (
                         <p className="p-4 text-sm text-base-content/70 text-center italic mt-10">No conversations yet.</p>
                    ) : (
                        <ul>
                            {conversations.map(conv => (
                                <li key={conv.id}
                                    // Highlight applies based on selectedConversation state
                                    className={`block border-b border-base-300 cursor-pointer transition duration-150 ease-in-out ${selectedConversation?.id === conv.id ? 'bg-primary/20' : 'hover:bg-base-300/70'}`}
                                    onClick={() => handleSelectConversation(conv)} // Use updated handler
                                >
                                     {/* Check if participant data exists and has a UID */}
                                     {conv.otherParticipant?.uid ? (
                                         <div className="flex items-center gap-3 p-3">
                                            {/* Avatar */}
                                            <div className="avatar flex-shrink-0">
                                                <div className="w-10 rounded-full ring ring-primary/50 ring-offset-base-100 ring-offset-1">
                                                    {conv.otherParticipant?.photoURL ? (
                                                         <img src={conv.otherParticipant.photoURL} alt={conv.otherParticipant?.name || 'User'} />
                                                    ) : (
                                                         <DefaultAvatar className="w-10 h-10" />
                                                    )}
                                                </div>
                                            </div>
                                            {/* Name & Last Message */}
                                            <div className="flex-grow overflow-hidden">
                                                <p className="font-medium text-sm truncate">{conv.otherParticipant?.name || '...'}</p>
                                                <p className="text-xs text-base-content/60 truncate mt-1">{conv.lastMessageText || 'No messages yet'}</p>
                                            </div>
                                            {/* Timestamp */}
                                            <span className="text-[10px] text-base-content/50 flex-shrink-0 ml-1 self-start pt-1">
                                                {formatTimestamp(conv.lastMessageTimestamp)}
                                            </span>
                                         </div>
                                     ) : (
                                         <div className="p-3 text-xs text-error">Error loading participant info</div> // Fallback if data is bad
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
            {/* --- MODIFIED: Conditional display based on screen size and mobileView state --- */}
            <div className={`
                 ${mobileView === 'conversation' ? 'flex' : 'hidden'} md:flex  // Use flex here for column layout
                 flex-col // Ensure vertical layout
                 w-full md:w-2/3 bg-base-100 h-full
            `}>
                {selectedConversation ? (
                    <>
                        {/* Chat Header --- MODIFIED --- */}
                        <div className="p-2 md:p-3 border-b border-base-300 flex items-center gap-2 sm:gap-3 flex-shrink-0 bg-base-200/30 sticky top-0 backdrop-blur-sm z-10">
                            {/* --- Back Button (Mobile Only) --- */}
                            <button
                                onClick={handleGoBackToList}
                                className="btn btn-ghost btn-sm btn-circle md:hidden mr-1" // Hide on md and up
                                aria-label="Back to conversations list"
                            >
                                <BackIcon />
                            </button>
                            {/* --- Avatar --- */}
                           <div className="avatar flex-shrink-0">
                               <div className="w-8 rounded-full">
                                    {selectedConversation.otherParticipant?.photoURL ? (
                                         <img src={selectedConversation.otherParticipant.photoURL} alt={selectedConversation.otherParticipant?.name} />
                                    ) : (
                                         <DefaultAvatar className="w-8 h-8" />
                                    )}
                               </div>
                           </div>
                           {/* --- Name --- */}
                           <p className="font-semibold text-sm sm:text-base flex-grow truncate">{selectedConversation.otherParticipant?.name || '...'}</p> {/* Allow name to take space and truncate */}
                        </div>

                        {/* Messages Container */}
                        <div className="flex-grow overflow-y-auto p-2 md:p-4 space-y-4">
                            {loadingMessages ? (
                                 <div className="flex justify-center items-center h-full pt-10"><span className="loading loading-dots loading-lg"></span></div>
                            ) : messages.length === 0 ? (
                                 <p className="text-center text-base-content/60 italic mt-10">No messages in this conversation yet.</p>
                            ) : (
                                messages.map(msg => (
                                    <div key={msg.id} className={`chat ${msg.senderUid === currentUser?.uid ? 'chat-end' : 'chat-start'}`}>
                                        {/* Optionally add chat image/header here if needed */}
                                        <div className={`chat-bubble text-sm md:text-base ${msg.senderUid === currentUser?.uid ? 'chat-bubble-primary' : 'chat-bubble-secondary'}`}>
                                            {msg.text}
                                            <time className="text-[10px] opacity-60 block mt-1 text-right">
                                                 {msg.timestamp instanceof Date ? msg.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '...'}
                                            </time>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} /> {/* Scroll anchor */}
                        </div>

                        {/* Message Input Form */}
                         <form onSubmit={handleSendMessage} className="p-3 border-t border-base-300 flex gap-2 flex-shrink-0 bg-base-200/50 sticky bottom-0">
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
                                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4 ml-1 hidden sm:inline"> {/* Hide icon on very small screens */}
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                                 </svg>
                            </button>
                         </form>
                         {/* Message Area Error Display */}
                         {error && error.includes('message') && <p className="p-2 text-xs text-error text-center flex-shrink-0">{error}</p>}
                    </>
                ) : (
                    // Placeholder when no conversation is selected (only visible on desktop now)
                    <div className="hidden md:flex items-center justify-center h-full">
                        <p className="text-base-content/60">Select a conversation to view messages.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Inbox;