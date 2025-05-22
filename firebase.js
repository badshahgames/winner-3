// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBci1YLe6TGuv9NHFRf1ljBnLH-ULj8jWs",
  authDomain: "color-trado.firebaseapp.com",
  projectId: "color-trado",
  storageBucket: "color-trado.firebasestorage.app",
  messagingSenderId: "960118997572",
  appId: "1:960118997572:web:4d533860f2daa609b3b211",
  measurementId: "G-F3QLVXY0NW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

export function logout() {
  return signOut(auth);
}
