// src/components/Login.jsx
import React, { useState, useEffect } from 'react';
import { auth, provider, db, storage, sendPasswordResetEmail } from "../services/firebase"; // Import sendPasswordResetEmail
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import GoogleIcon from './GoogleIcon';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

// Basic eye icons (replace with SVG icons from a library like heroicons if preferred)
const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5"> <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /> <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /> </svg>;
const EyeSlashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5"> <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L6.228 6.228" /> </svg>;


// Helper function to map Firebase errors to user-friendly messages
const mapAuthError = (errorCode) => {
    switch (errorCode) {
        case 'auth/invalid-email':
            return 'Invalid email format. Please check your email.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return 'Incorrect email or password. Please try again.';
        case 'auth/email-already-in-use':
            return 'This email is already registered. Please login or use a different email.';
        case 'auth/weak-password':
            return 'Password is too weak. It should be at least 6 characters long.';
        case 'auth/operation-not-allowed':
            return 'Authentication method not enabled. Please contact support.';
        case 'auth/popup-closed-by-user':
             return 'Google Sign-in popup closed before completion.';
        case 'auth/cancelled-popup-request':
             return 'Multiple sign-in attempts detected. Please try again.';
        // Add more specific mappings as needed
        default:
            return 'An authentication error occurred. Please try again later.';
    }
};


const Login = ({ setIsAuth }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [isSignup, setIsSignup] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false); // State for password visibility
    const [showModal, setShowModal] = useState(false);
    const [name, setName] = useState('');
    const [gender, setGender] = useState('');
    const [bio, setBio] = useState('');
    const [profilePictureUrl, setProfilePictureUrl] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [authError, setAuthError] = useState('');
    const [resetEmailSent, setResetEmailSent] = useState(false); // For forgot password feedback

    useEffect(() => {
        // No initial check needed here if App.jsx handles it
    }, [navigate, setIsAuth]);

    const resetForm = (clearAuthMode = true) => {
        setEmail('');
        setPassword('');
        setAuthError('');
        setResetEmailSent(false);
        if (clearAuthMode) {
             setIsSignup(false); // Default back to login unless toggling
             // Reset modal fields only if switching modes or explicitly closing
             setName('');
             setGender('');
             setBio('');
             setProfilePictureUrl('');
             setImageFile(null);
        }
    };

    const toggleMode = () => {
        setIsSignup(!isSignup);
        resetForm(false); // Don't reset modal fields when just toggling
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setAuthError('');
        setResetEmailSent(false);
        try {
            let userCredential;
            if (isSignup) {
                // --- Sign Up ---
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
                // Pre-fill modal with email user's name part if possible
                setName(email.split('@')[0] || '');
                setShowModal(true); // Show modal to complete profile
            } else {
                // --- Login ---
                await signInWithEmailAndPassword(auth, email, password);
                setIsAuth(true);
                navigate("/admin"); // Redirect to admin panel on successful login
            }
        } catch (error) {
            console.error("Authentication error:", error);
            setAuthError(mapAuthError(error.code || 'unknown')); // Use the error mapping function
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setAuthError('');
        setResetEmailSent(false);
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Check if profile exists in Firestore
            const profileRef = doc(db, "profiles", user.uid);
            const profileSnap = await getDoc(profileRef);

            if (!profileSnap.exists()) {
                // Profile doesn't exist, show modal to complete it
                // Pre-fill name and potentially profile picture from Google
                setName(user.displayName || '');
                setProfilePictureUrl(user.photoURL || ''); // Store the URL from Google
                setShowModal(true);
            } else {
                // Profile exists, proceed to admin panel
                setIsAuth(true);
                navigate("/admin");
            }
        } catch (error) {
            console.error("Google sign-in error:", error);
            setAuthError(mapAuthError(error.code || 'unknown-google')); // Use the error mapping function
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file); // Store the file object
            // Show local preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePictureUrl(reader.result); // Set preview URL
            };
            reader.readAsDataURL(file);
        }
    };

    // --- Complete Signup (Modal Submission) ---
    const completeSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setAuthError('');
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("No user logged in!");

            let finalProfilePictureUrl = profilePictureUrl; // Start with existing (Google photo or preview)

            // If a *new* image file was selected in the modal, upload it
            if (imageFile) {
                const storageRef = ref(storage, `profilePictures/${user.uid}/${imageFile.name}`);
                const uploadTask = uploadBytesResumable(storageRef, imageFile);

                // Await the upload completion to get the final URL
                finalProfilePictureUrl = await new Promise((resolve, reject) => {
                    uploadTask.on(
                        'state_changed',
                        () => {}, // Progress updates (optional)
                        (err) => {
                            console.error("Modal image upload failed:", err);
                            reject(new Error("Image upload failed. Please try saving again."));
                        },
                        async () => {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            resolve(downloadURL); // Resolve with the Firestore URL
                        }
                    );
                });
            } // If no new imageFile, finalProfilePictureUrl remains the one from Google or preview

            // Save profile data to Firestore
            const profileRef = doc(db, "profiles", user.uid);
            await setDoc(profileRef, {
                name: name.trim(), // Trim whitespace
                gender,
                bio: bio.trim(), // Trim whitespace
                profilePictureUrl: finalProfilePictureUrl, // Use the final URL (uploaded or from Google)
                email: user.email, // Store email for reference
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }, { merge: true }); // Use merge: true to create or update

            setIsAuth(true);
            setShowModal(false); // Close modal
            navigate("/admin"); // Redirect to admin panel
        } catch (error) {
            console.error("Error completing signup:", error);
            setAuthError(error.message || "Failed to save profile details.");
        } finally {
            setLoading(false);
        }
    };

     // --- Handle Forgot Password ---
     const handleForgotPassword = async () => {
         if (!email) {
             setAuthError("Please enter your email address first.");
             return;
         }
         setLoading(true);
         setAuthError('');
         setResetEmailSent(false);
         try {
             await sendPasswordResetEmail(auth, email);
             setResetEmailSent(true); // Set state to show success message
             setAuthError(''); // Clear any previous errors
         } catch (error) {
             console.error("Forgot password error:", error);
             setAuthError(mapAuthError(error.code || 'unknown-reset'));
         } finally {
             setLoading(false);
         }
     };


    return (
        // Added subtle gradient background and increased vertical padding
        <div className="flex items-center justify-center min-h-[calc(100vh-128px)] bg-gradient-to-br from-base-200 to-base-300 px-4 py-10">
            {/* Added slight transparency and larger padding */}
            <div className="card w-full max-w-md bg-base-100 shadow-xl p-6 md:p-8 bg-opacity-95 backdrop-blur-sm">
                <div className="card-body items-center text-center p-0"> {/* Removed card-body padding */}
                    <h2 className="card-title text-3xl mb-6 font-bold">{isSignup ? "Create Account" : "Welcome Back"}</h2>

                    {/* Error Alert */}
                    {authError && <div role="alert" className="alert alert-error mb-4 text-sm py-2 px-3"><svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>{authError}</span></div>}

                     {/* Reset Password Success Alert */}
                    {resetEmailSent && <div role="alert" className="alert alert-success mb-4 text-sm py-2 px-3"><svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>Password reset email sent! Check your inbox.</span></div>}

                    {/* --- Email/Password Form --- */}
                    <form onSubmit={handleAuth} className="space-y-4 w-full">
                        {/* Email Input */}
                        <div className="form-control">
                            <label className="label sr-only" htmlFor="email"> {/* Added label for accessibility */}
                                <span className="label-text">Email</span>
                            </label>
                            <input
                                id="email"
                                type="email"
                                placeholder="Email Address"
                                className="input input-bordered w-full"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                aria-required="true"
                                aria-invalid={authError ? 'true' : 'false'}
                            />
                        </div>

                         {/* Password Input with Visibility Toggle */}
                        <div className="form-control">
                             <label className="label sr-only" htmlFor="password"> {/* Added label for accessibility */}
                                <span className="label-text">Password</span>
                             </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Password"
                                    className="input input-bordered w-full pr-10" // Added padding for icon
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    aria-required="true"
                                    aria-invalid={authError ? 'true' : 'false'}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                     {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                                </button>
                            </div>
                             {/* Forgot Password Link - only show in Login mode */}
                             {!isSignup && (
                                <label className="label">
                                    <button type="button" onClick={handleForgotPassword} className="label-text-alt link link-hover text-sm" disabled={loading || !email}>
                                         Forgot password?
                                    </button>
                                </label>
                             )}
                        </div>

                        {/* Submit Button */}
                        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                            {loading ? <span className="loading loading-spinner loading-sm"></span> : isSignup ? "Sign Up" : "Login"}
                        </button>
                    </form>

                    {/* --- Divider and Google Sign-In --- */}
                    <div className="divider my-6">OR</div>
                    <button onClick={handleGoogleSignIn} disabled={loading} className="btn btn-outline btn-block">
                        {loading ? <span className="loading loading-spinner loading-sm"></span> : <GoogleIcon />}
                        <span className="ml-2">{loading ? "Processing..." : "Continue with Google"}</span>
                    </button>

                    {/* --- Toggle Login/Signup Mode --- */}
                    <div className="text-center mt-6">
                        <span className="text-sm text-base-content/80">
                            {isSignup ? "Already have an account? " : "Don't have an account? "}
                        </span>
                        <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={toggleMode}>
                            {isSignup ? "Log In" : "Sign Up"}
                        </button>
                    </div>
                </div>
            </div>

            {/* --- Profile Completion Modal --- */}
            {showModal && (
                // Improved modal styling using DaisyUI classes
                <div className="modal modal-open modal-bottom sm:modal-middle">
                    <div className="modal-box relative"> {/* Added relative for close button positioning */}
                        {/* Close Button */}
                        <button onClick={() => { setShowModal(false); resetForm(); }} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" aria-label="Close profile setup">✕</button>

                        <h3 className="font-bold text-xl mb-4">Complete Your Profile</h3>
                         {/* Modal Specific Error */}
                        {authError && <div role="alert" className="alert alert-error mb-4 text-sm py-2 px-3"><span>{authError}</span></div>}

                        <form onSubmit={completeSignup} className="space-y-4">
                             {/* Profile Picture */}
                            <div className="flex flex-col items-center space-y-3 mb-3">
                                <div className="avatar">
                                    <div className="w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                                        {profilePictureUrl ? (
                                            <img src={profilePictureUrl} alt="Profile Preview" />
                                        ) : (
                                            // Simple SVG Placeholder
                                             <div className="flex items-center justify-center h-full bg-base-300">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-base-content opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                                </svg>
                                             </div>
                                        )}
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="file-input file-input-bordered file-input-sm w-full max-w-xs"
                                    disabled={loading}
                                    aria-label="Upload profile picture"
                                />
                            </div>

                            {/* Name Input */}
                            <div className="form-control">
                                <label className="label" htmlFor="profile-name"><span className="label-text">Name</span></label>
                                <input id="profile-name" type="text" placeholder="Your Name" className="input input-bordered w-full" value={name} onChange={(e) => setName(e.target.value)} required aria-required="true"/>
                            </div>
                            {/* Gender Select */}
                            <div className="form-control">
                                <label className="label" htmlFor="profile-gender"><span className="label-text">Gender</span></label>
                                <select id="profile-gender" className="select select-bordered w-full" value={gender} onChange={(e) => setGender(e.target.value)}>
                                    <option value="" disabled>Select Gender (Optional)</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                    <option value="prefer_not_to_say">Prefer not to say</option>
                                </select>
                            </div>
                             {/* Bio Textarea */}
                            <div className="form-control">
                                <label className="label" htmlFor="profile-bio"><span className="label-text">Bio</span></label>
                                <textarea id="profile-bio" className="textarea textarea-bordered w-full" rows="3" placeholder="Tell us a bit about yourself (Optional)" value={bio} onChange={(e) => setBio(e.target.value)}></textarea>
                            </div>

                            {/* Modal Actions */}
                            <div className="modal-action mt-6">
                                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn btn-ghost" disabled={loading}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? <span className="loading loading-spinner loading-sm"></span> : "Save Profile"}
                                </button>
                            </div>
                        </form>
                    </div>
                     {/* Click outside to close */}
                     <form method="dialog" className="modal-backdrop">
                       <button onClick={() => { setShowModal(false); resetForm(); }}>close</button>
                     </form>
                </div>
            )}
        </div>
    );
};

export default Login;