import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, remove } from 'firebase/database';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, User } from 'firebase/auth';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAlgrKArihDhA20GKZFYs9oo5kxX1jYm8I",
  authDomain: "ok-hub-845b2.firebaseapp.com",
  databaseURL: "https://ok-hub-845b2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ok-hub-845b2",
  storageBucket: "ok-hub-845b2.appspot.com",
  messagingSenderId: "146569981748",
  appId: "1:146569981748:web:7e2ef5ab43899d3ea9ff61",
  measurementId: "G-P0JJ2BWDQQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
export const auth = getAuth(app);

const feedbackRef = ref(database, 'feedback');

export const listenToFeedback = (callback: (value: any) => void) => {
  return onValue(feedbackRef, (snapshot) => {
    callback(snapshot.val());
  });
};

export const saveFeedback = (item: any) => {
  const newFeedbackRef = ref(database, `feedback/${item.id}`);
  return set(newFeedbackRef, item);
};

export const updateFeedbackStatus = (id: number, status: string) => {
  const feedbackItemRef = ref(database, `feedback/${id}`);
  return update(feedbackItemRef, { status });
};

export const updateFeedbackNotes = (id: number, notes: string) => {
  const feedbackItemRef = ref(database, `feedback/${id}`);
  return update(feedbackItemRef, { internalNotes: notes });
};

export const deleteFeedback = (id: number) => {
  const feedbackItemRef = ref(database, `feedback/${id}`);
  return remove(feedbackItemRef);
};

export const adminSignIn = (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const adminSignOut = () => {
  return signOut(auth);
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};