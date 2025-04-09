import { auth, provider } from "../services/firebase";
import { signInWithPopup } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from 'react';

const Login = ({ setIsAuth }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      const token = result.user.accessToken;

      // Store the token in localStorage first
      localStorage.setItem('authToken', token);
      setIsAuth(true);

      // Navigate to admin after setting auth
      navigate("/admin");
    } catch (error) {
      console.error("Error during sign-in:", error);
      alert("Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Check if user is already authenticated
  useEffect(() => {
    const storedAuthToken = localStorage.getItem('authToken');
    if (storedAuthToken) {
      setIsAuth(true);
      navigate("/admin");
    }
  }, [navigate, setIsAuth]);

  return (
    <div>
      <h2>Sign in</h2>
      <button onClick={signIn} disabled={loading}>
        {loading ? "Signing in..." : "Sign in with Google"}
      </button>
    </div>
  );
};

export default Login;
