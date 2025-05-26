// src/components/admin/ManageUsersComponent.jsx
import React, { useState } from 'react';
import { getFunctions, httpsCallable } from "firebase/functions";

// Initialize Firebase Functions
const functions = getFunctions();
// Reference your Cloud Functions
const setAdminRoleCallable = httpsCallable(functions, 'setAdminRole');
const removeAdminRoleCallable = httpsCallable(functions, 'removeAdminRole');

const ManageUsersComponent = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' }); // { type: 'success'/'error', text: '...' }
    const [loading, setLoading] = useState(false);

    const handleRoleChange = async (action) => {
        if (!email.trim()) {
            setMessage({ type: 'error', text: 'Please enter a user email address.' });
            return;
        }
        setLoading(true);
        setMessage({ type: '', text: '' }); // Clear previous message

        const callableFunction = action === 'add' ? setAdminRoleCallable : removeAdminRoleCallable;
        const actionText = action === 'add' ? 'grant admin to' : 'remove admin from';
        const successText = action === 'add' ? 'is now an admin' : 'is no longer an admin';

        try {
            console.log(`Calling ${action} admin function for: ${email}`);
            const result = await callableFunction({ email: email.trim() });
            console.log("Cloud function result:", result);
            setMessage({ type: 'success', text: result.data.result || `Successfully updated role for ${email}.` });
            setEmail(''); // Clear input on success

        } catch (error) {
            console.error(`Error trying to ${actionText} ${email}:`, error);
            // error object from httpsCallable might have code and message properties
            const errorMessage = error.message || `Failed to ${actionText} ${email}. Check console for details.`;
            setMessage({ type: 'error', text: errorMessage });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            <h2 className="text-2xl font-semibold mb-4">Manage Admin Roles</h2>

            <div className="p-4 bg-base-200 rounded-lg shadow max-w-md">
                <p className="text-sm mb-3 text-base-content/80">
                    Enter the email address of the user whose admin status you want to change.
                </p>
                <div className="form-control w-full mb-4">
                    <label htmlFor="user-email" className="label sr-only">
                        <span className="label-text">User Email</span>
                    </label>
                    <input
                        id="user-email"
                        type="email"
                        placeholder="user@example.com"
                        className="input input-bordered w-full"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                    <button
                        onClick={() => handleRoleChange('add')}
                        className="btn btn-success flex-1"
                        disabled={loading || !email}
                    >
                        {loading ? <span className="loading loading-spinner loading-sm"></span> : 'Make Admin'}
                    </button>
                    <button
                        onClick={() => handleRoleChange('remove')}
                        className="btn btn-error btn-outline flex-1"
                        disabled={loading || !email}
                    >
                        {loading ? <span className="loading loading-spinner loading-sm"></span> : 'Remove Admin'}
                    </button>
                </div>

                {/* Status Message */}
                {message.text && (
                    <div className={`mt-4 text-sm ${message.type === 'success' ? 'text-success' : 'text-error'}`}>
                        {message.text}
                    </div>
                )}
            </div>
            {/* Optional: Add a section here later to LIST current admins */}
            {/* This would require another Cloud Function or querying profiles */}
        </div>
    );
};

export default ManageUsersComponent;
