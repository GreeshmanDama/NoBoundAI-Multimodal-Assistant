// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FRIEBASE_API_KEY,
  authDomain: "contexai-37cfa.firebaseapp.com",
  projectId: "contexai-37cfa",
  storageBucket: "contexai-37cfa.firebasestorage.app",
  messagingSenderId: "632981723241",
  appId: "1:632981723241:web:4e9530bb2ed3b505ddeaf8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()