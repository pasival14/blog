import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// Import sendPasswordResetEmail along with other auth functions
import { getAuth, GoogleAuthProvider, sendPasswordResetEmail } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAw14z2QucUib8s-3n7XC-C38eCis-OwP0",
    authDomain: "blog-3486f.firebaseapp.com",
    projectId: "blog-3486f",
    storageBucket: "blog-3486f.appspot.com",
    messagingSenderId: "366310134891",
    appId: "1:366310134891:web:db6a9e63244fc3fc1e4d2e",
    measurementId: "G-E2L1EVXK43"
};

console.log("Firebase initialization started...");
// Initialize Firebase
const app = initializeApp(firebaseConfig);
console.log("Firebase initialization completed.");
console.log("Firebase configuration:", firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// Add sendPasswordResetEmail to the export list
export { db, auth, provider, storage, sendPasswordResetEmail };