// src/components/admin/Profile.jsx
import React, { useState, useEffect } from 'react';
import { auth, db, storage } from '../../services/firebase'; // Make sure storage is exported from firebase.js
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth'; // Import updateProfile for Auth user

const Profile = () => {
    const [name, setName] = useState('');
    const [gender, setGender] = useState('');
    const [bio, setBio] = useState('');
    const [profilePictureUrl, setProfilePictureUrl] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const currentUser = auth.currentUser;

    // Fetch profile data on component mount
    useEffect(() => {
        if (currentUser) {
            const profileRef = doc(db, 'profiles', currentUser.uid);
            getDoc(profileRef)
                .then((docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setName(data.name || currentUser.displayName || '');
                        setGender(data.gender || '');
                        setBio(data.bio || '');
                        setProfilePictureUrl(data.profilePictureUrl || currentUser.photoURL || ''); // Use Auth photoURL as fallback
                    } else {
                         // If no profile doc, use data from Auth if available
                        setName(currentUser.displayName || '');
                        setProfilePictureUrl(currentUser.photoURL || '');
                    }
                })
                .catch((err) => {
                    console.error("Error fetching profile:", err);
                    setError("Failed to load profile data.");
                });
        }
    }, [currentUser]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            // Show preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePictureUrl(reader.result); // Show local preview
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        if (!currentUser) {
            setError("You must be logged in to update your profile.");
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');
        let newImageUrl = profilePictureUrl; // Keep existing URL if no new image

        try {
            // 1. Upload new image if selected
            if (imageFile) {
                const storageRef = ref(storage, `profilePictures/${currentUser.uid}/${imageFile.name}`);
                const uploadTask = uploadBytesResumable(storageRef, imageFile);

                await new Promise((resolve, reject) => {
                    uploadTask.on(
                        'state_changed',
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setUploadProgress(progress);
                        },
                        (err) => {
                            console.error("Upload failed:", err);
                            reject(new Error("Image upload failed."));
                        },
                        async () => {
                            newImageUrl = await getDownloadURL(uploadTask.snapshot.ref);
                            setProfilePictureUrl(newImageUrl); // Update state with final URL
                            resolve();
                        }
                    );
                });
            }

            // 2. Update Firestore profile document
            const profileRef = doc(db, 'profiles', currentUser.uid);
            const profileData = {
                name,
                gender,
                bio,
                profilePictureUrl: newImageUrl, // Use the potentially updated URL
                updatedAt: new Date(),
            };
            // Use setDoc with merge: true to create or update
            await setDoc(profileRef, profileData, { merge: true });

            // 3. Update Firebase Auth profile (optional but good practice)
            await updateProfile(currentUser, {
                displayName: name,
                photoURL: newImageUrl
            });

            setSuccess('Profile updated successfully!');
            setImageFile(null); // Clear selected file after successful upload
            setUploadProgress(0);

        } catch (err) {
            console.error("Profile update error:", err);
            setError(`Failed to update profile: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full h-full mt-12 md:mt-0 p-2 md:p-4 overflow-y-auto">
            <h2 className="text-xl md:text-2xl text-center md:text-left font-semibold mb-6">Edit Profile</h2>
            {error && <div className="alert alert-error mb-4">{error}</div>}
            {success && <div className="alert alert-success mb-4">{success}</div>}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
                {/* Profile Picture */}
                <div className="flex flex-col items-center space-y-2">
                    <div className="w-20 md:w-24 h-20 md:h-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 flex items-center justify-center bg-base-300 overflow-hidden"> {/* Added h-24, flex, items-center, justify-center, bg-base-300, overflow-hidden */}
                        {profilePictureUrl ? (
                            <img src={profilePictureUrl} alt="Profile Preview" className="w-full h-full object-cover" /> // Added className for object-cover
                        ) : (
                            // Simple SVG User Icon Placeholder
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-base-content opacity-50" /* Adjusted size and styling */ fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                            </svg>
                        )}
                    </div>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="file-input file-input-bordered file-input-sm w-full max-w-[250px] md:max-w-xs"
                        disabled={loading}
                    />
                    {uploadProgress > 0 && <progress className="progress progress-primary w-56" value={uploadProgress} max="100"></progress>}
                </div>

                {/* Name */}
                <div>
                    <label className="label">
                        <span className="label-text">Name</span>
                    </label>
                    <input
                        type="text"
                        placeholder="Your Name"
                        className="input input-bordered w-full"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={loading}
                    />
                </div>

                {/* Gender */}
                <div>
                    <label className="label">
                        <span className="label-text">Gender</span>
                    </label>
                    <select
                        className="select select-bordered w-full"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        disabled={loading}
                    >
                        <option value="" disabled>Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                </div>

                {/* Bio */}
                <div>
                    <label className="label">
                        <span className="label-text">Bio</span>
                    </label>
                    <textarea
                        className="textarea textarea-bordered w-full"
                        rows="3"
                        placeholder="Tell us a bit about yourself"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        disabled={loading}
                    ></textarea>
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                    <button
                        type="submit"
                        className="btn btn-primary w-full"
                        disabled={loading}
                    >
                        {loading ? <span className="loading loading-spinner"></span> : 'Update Profile'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Profile;