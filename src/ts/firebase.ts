import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// NOTE: Firebase の Web 設定は秘匿情報ではなく、実質的な防御は firestore.rules 側で行う。
// （他のミニアプリと同様に、この値はコミットして良い）
const firebaseConfig = {
  apiKey: 'AIzaSyCxMFu2xnLJ4L_91DB1MhkRDrx9iOSxMQY',
  authDomain: 'kigyo-sugoroku.firebaseapp.com',
  projectId: 'kigyo-sugoroku',
  storageBucket: 'kigyo-sugoroku.firebasestorage.app',
  messagingSenderId: '1000688457450',
  appId: '1:1000688457450:web:1dedf098c5279b808a6993',
};

export const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
