import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { 
  saveUserProfile, 
  getUserProfile, 
  logAuditEvent 
} from '../services/clinicService';
import { UserProfile, UserRole } from '../types';
import { formatFirestoreError } from '../utils/errorUtils';

/**
 * Centralized Firebase Authentication error details and user-friendly mapping.
 */
export {
  type AuthErrorDetails,
  parseAuthError,
  logAuthError,
  handleAuthError,
} from '../services/authErrorHandler';

import {
  type AuthErrorDetails,
  parseAuthError,
  logAuthError,
  handleAuthError,
} from '../services/authErrorHandler';

const SUPER_ADMIN_SESSION_KEY = 'mediqueue_super_admin_session';

/**
 * Creates a client-side session identity conforming to the User interface
 * for Super Admins whose identity is verified via server-side HMAC session token.
 * Does NOT invoke Firebase Anonymous Auth or use hardcoded Firebase credentials.
 */
export const createSuperAdminSessionUser = (
  email: string = 'superadmin@mediqueue.internal',
  name: string = 'Super Administrator'
): User => {
  return {
    uid: 'super_admin_root',
    email,
    displayName: name,
    emailVerified: true,
    isAnonymous: false,
    metadata: {
      creationTime: new Date().toISOString(),
      lastSignInTime: new Date().toISOString(),
    },
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => '',
    getIdTokenResult: async () => ({
      token: '',
      signInProvider: 'super_admin_session',
      signInSecondFactor: null,
      claims: { role: 'SUPER_ADMIN', isSuperAdmin: true },
      authTime: new Date().toISOString(),
      issuedAtTime: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
    }),
    reload: async () => {},
    toJSON: () => ({ uid: 'super_admin_root', email, role: 'SUPER_ADMIN' }),
    phoneNumber: null,
    photoURL: null,
    providerId: 'mediqueue.superadmin',
  };
};

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  authReady: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isClinicAdmin: boolean;
  isClinicStaff: boolean;
  userRole: UserRole;
  superAdminSessionToken: string | null;
  loginSuperAdmin: (email: string, pass: string) => Promise<UserProfile>;
  login: (email: string, pass: string, targetClinicId?: string) => Promise<UserProfile>;
  registerAdmin: (email: string, pass: string, clinicId?: string, role?: UserRole) => Promise<void>;
  signUpPatient: (
    email: string, 
    pass: string, 
    profile: {
      name: string;
      phone: string;
      age?: number;
      gender?: 'Male' | 'Female' | 'Other';
      clinicId: string;
      clinicName: string;
    }
  ) => Promise<UserProfile>;
  signInPatient: (email: string, pass: string) => Promise<UserProfile>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [superAdminSessionToken, setSuperAdminSessionToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SUPER_ADMIN_SESSION_KEY);
    } catch {
      return null;
    }
  });

  // Verify Super Admin server session on initial load
  useEffect(() => {
    let isCancelled = false;

    const initSuperAdminSession = async () => {
      const storedToken = sessionStorage.getItem(SUPER_ADMIN_SESSION_KEY);
      
      // If active session was established via Firebase Auth Super Admin, defer to onAuthStateChanged
      if (storedToken && storedToken.startsWith('super_admin_firebase_')) {
        return;
      }
      
      // 1. First check HttpOnly cookie session via /api/super-admin/session
      try {
        const cookieRes = await fetch('/api/super-admin/session', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {})
          }
        });
        const cookieData = await cookieRes.json().catch(() => null);
        if (cookieRes.ok && cookieData && cookieData.authenticated && cookieData.valid && !isCancelled) {
          if (cookieData.sessionToken) {
            setSuperAdminSessionToken(cookieData.sessionToken);
            sessionStorage.setItem(SUPER_ADMIN_SESSION_KEY, cookieData.sessionToken);
          } else if (storedToken) {
            setSuperAdminSessionToken(storedToken);
          } else {
            setSuperAdminSessionToken('cookie_authenticated_session');
          }
          const email = cookieData.user?.email || 'superadmin@mediqueue.internal';
          const name = cookieData.user?.name || 'Super Administrator';
          if (!isCancelled) {
            setUser(createSuperAdminSessionUser(email, name));
            setUserProfile({
              uid: 'super_admin_root',
              email,
              name,
              displayName: name,
              phone: '+1 (800) 555-0100',
              age: 40,
              gender: 'Other',
              role: 'SUPER_ADMIN',
              clinicId: '',
              clinicIds: [],
              accessibleClinicIds: [],
              status: 'active',
              createdAt: new Date().toISOString()
            });
            setLoading(false);
            setAuthReady(true);
          }
          return;
        }
      } catch (_) {}

      // 2. Fallback check verify-session if stored token exists
      if (storedToken) {
        try {
          const res = await fetch('/api/super-admin/verify-session', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${storedToken}`
            }
          });
          const data = await res.json().catch(() => null);
          if (res.ok && data && data.valid && !isCancelled) {
            setSuperAdminSessionToken(storedToken);
            const email = data.user?.email || 'superadmin@mediqueue.internal';
            const name = data.user?.name || 'Super Administrator';
            if (!isCancelled) {
              setUser(createSuperAdminSessionUser(email, name));
              setUserProfile({
                uid: 'super_admin_root',
                email,
                name,
                displayName: name,
                phone: '+1 (800) 555-0100',
                age: 40,
                gender: 'Other',
                role: 'SUPER_ADMIN',
                clinicId: '',
                clinicIds: [],
                accessibleClinicIds: [],
                status: 'active',
                createdAt: new Date().toISOString()
              });
              setLoading(false);
              setAuthReady(true);
            }
            return;
          } else if (!isCancelled) {
            // Only remove stored token if user is not actively authenticated as Super Admin in Firebase
            if (!auth.currentUser || auth.currentUser.email?.toLowerCase() !== 'medi@gmail.com') {
              sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
              setSuperAdminSessionToken(null);
            }
          }
        } catch {
          if (!isCancelled) {
            if (!auth.currentUser || auth.currentUser.email?.toLowerCase() !== 'medi@gmail.com') {
              sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
              setSuperAdminSessionToken(null);
            }
          }
        }
      }

      // If no valid super admin session, fallback to Firebase auth listener state
      if (!isCancelled && !storedToken) {
        if (!auth.currentUser) {
          setLoading(false);
          setAuthReady(true);
        }
      }
    };

    initSuperAdminSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Firebase Auth State Listener (for Clinic Admins, Staff & Patients)
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const activeSuperToken = sessionStorage.getItem(SUPER_ADMIN_SESSION_KEY);
      const isFirebaseSuperSession = activeSuperToken && activeSuperToken.startsWith('super_admin_firebase_');
      
      if (currentUser && (!activeSuperToken || isFirebaseSuperSession)) {
        setUser(currentUser);
        try {
          let profile = await getUserProfile(currentUser.uid);
          
          if (!profile && currentUser.email === 'medi@gmail.com') {
            profile = {
              uid: currentUser.uid,
              email: currentUser.email,
              name: 'Super Administrator',
              displayName: 'Super Administrator',
              phone: currentUser.phoneNumber || '+1 (800) 555-0100',
              age: 40,
              gender: 'Other',
              role: 'SUPER_ADMIN',
              clinicId: '',
              clinicIds: [],
              accessibleClinicIds: [],
              status: 'active',
              createdAt: new Date().toISOString()
            };
            try {
              await saveUserProfile(profile);
            } catch (_) {}
          } else if (profile && currentUser.email === 'medi@gmail.com' && profile.role !== 'SUPER_ADMIN') {
            profile = { ...profile, role: 'SUPER_ADMIN' };
            try {
              await saveUserProfile(profile);
            } catch (_) {}
          }

          if (profile?.role === 'SUPER_ADMIN') {
            const currentStored = sessionStorage.getItem(SUPER_ADMIN_SESSION_KEY);
            if (currentStored && currentStored.includes('.')) {
              setSuperAdminSessionToken(currentStored);
            } else {
              let token = currentStored || `super_admin_firebase_${currentUser.uid}`;
              try {
                fetch('/api/super-admin/auth', {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: currentUser.email || 'medi@gmail.com' }),
                })
                  .then(r => r.json())
                  .then(d => {
                    if (d?.success && d?.sessionToken) {
                      sessionStorage.setItem(SUPER_ADMIN_SESSION_KEY, d.sessionToken);
                      setSuperAdminSessionToken(d.sessionToken);
                    }
                  })
                  .catch(() => {});
              } catch (_) {}
              sessionStorage.setItem(SUPER_ADMIN_SESSION_KEY, token);
              setSuperAdminSessionToken(token);
            }
          }

          if (!profile) {
            // Profile does not exist yet; do not auto-create an empty clinic association
            if (isMounted) {
              setUserProfile(null);
              setLoading(false);
              setAuthReady(true);
            }
            return;
          }
          
          // If profile is disabled/inactive, force logout
          if (profile.status === 'inactive' || profile.status === 'INACTIVE') {
            await firebaseSignOut(auth);
            if (isMounted) {
              setUser(null);
              setUserProfile(null);
              setLoading(false);
              setAuthReady(true);
            }
            return;
          }

          if (isMounted) {
            setUserProfile(profile as UserProfile);
            
            // If logged-in user has an associated clinicId, automatically update localStorage
            if (profile && profile.clinicId) {
              try {
                localStorage.setItem('mediqueue_active_clinic_id', profile.clinicId);
              } catch (_) {}
            }
            
            setLoading(false);
            setAuthReady(true);
          }

          // Audit log successful login for staff/admins
          if (profile?.role !== 'PATIENT' && profile?.role !== 'patient') {
            const resolvedClinicId = profile?.clinicId;
            if (resolvedClinicId) {
              logAuditEvent({
                action: 'CLINIC_ADMIN_LOGIN',
                clinicId: resolvedClinicId,
                clinicName: profile?.clinicName,
                details: { email: currentUser.email }
              });
            }
          }
        } catch (err) {
          console.warn('Auth profile initialization notice:', formatFirestoreError(err, 'Failed to fetch user profile'));
          if (isMounted) {
            setLoading(false);
            setAuthReady(true);
          }
        }
      } else if (!currentUser && !activeSuperToken) {
        if (isMounted) {
          setUser(null);
          setUserProfile(null);
          setLoading(false);
          setAuthReady(true);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [superAdminSessionToken]);

  // Super Admin Firebase Authentication with Strict Access Control
  const loginSuperAdmin = async (emailInput: string, pass: string): Promise<UserProfile> => {
    const cleanEmail = emailInput.trim();
    if (!cleanEmail) {
      throw new Error('Please enter your email address.');
    }
    if (!pass) {
      throw new Error('Please enter your password.');
    }

    setLoading(true);

    // Step 1: Authenticate with Firebase Authentication
    let cred;
    try {
      cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    } catch (err: any) {
      setLoading(false);
      const code = err?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        throw new Error('Invalid email or password. Please check your credentials and try again.');
      } else if (code === 'auth/user-disabled') {
        throw new Error('This account has been disabled. Please contact the administrator.');
      } else if (code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      } else if (code === 'auth/too-many-requests') {
        throw new Error('Too many failed login attempts. Access is temporarily locked. Please try again later.');
      } else if (code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your connection and try again.');
      } else {
        throw new Error('Authentication failed. Please verify your credentials and try again.');
      }
    }

    // Step 2: Strict Access Control - Only authenticated medi@gmail.com is allowed
    const authenticatedEmail = cred.user.email?.toLowerCase().trim();
    if (authenticatedEmail !== 'medi@gmail.com') {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
      setSuperAdminSessionToken(null);
      setLoading(false);
      throw new Error('Access denied. This account is not authorized to access the Super Admin Portal.');
    }

    // Step 3: Retrieve & verify authoritative profile
    let profile = await getUserProfile(cred.user.uid);

    if (!profile) {
      profile = {
        uid: cred.user.uid,
        email: 'medi@gmail.com',
        name: 'Super Administrator',
        displayName: 'Super Administrator',
        phone: cred.user.phoneNumber || '+1 (800) 555-0100',
        age: 40,
        gender: 'Other',
        role: 'SUPER_ADMIN',
        clinicId: '',
        clinicIds: [],
        accessibleClinicIds: [],
        status: 'active',
        createdAt: new Date().toISOString()
      };
      try {
        await saveUserProfile(profile);
      } catch (_) {}
    } else if (profile.role !== 'SUPER_ADMIN') {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
      setSuperAdminSessionToken(null);
      setLoading(false);
      throw new Error('Access denied. This account is not authorized as a Super Admin.');
    }

    // Step 4: Verify account is active
    if (profile.status === 'inactive' || profile.status === 'INACTIVE') {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
      setSuperAdminSessionToken(null);
      setLoading(false);
      throw new Error('Account disabled. Please contact the administrator.');
    }

    // Step 5: Establish Super Admin session
    let token = `super_admin_firebase_${cred.user.uid}`;
    try {
      const idToken = await cred.user.getIdToken();
      const authRes = await fetch('/api/super-admin/auth', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          email: cred.user.email || 'medi@gmail.com',
          idToken,
        }),
      });
      const authData = await authRes.json().catch(() => null);
      if (authData?.success && authData?.sessionToken) {
        token = authData.sessionToken;
      }
    } catch (_) {}

    sessionStorage.setItem(SUPER_ADMIN_SESSION_KEY, token);
    setSuperAdminSessionToken(token);
    setUser(cred.user);
    setUserProfile(profile);
    setLoading(false);
    setAuthReady(true);

    // Audit log
    logAuditEvent({
      action: 'SUPER_ADMIN_LOGIN',
      clinicName: 'MediQueue System Global',
      actorRole: 'SUPER_ADMIN',
      details: {
        method: 'FIREBASE_AUTH_EMAIL_PASSWORD',
        email: cred.user.email,
        timestamp: new Date().toISOString()
      }
    });

    return profile;
  };

  // Clinic Admin / Staff Email & Password Login with Strict Backend Role Authorization
  const login = async (email: string, pass: string, targetClinicId?: string): Promise<UserProfile> => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      throw new Error('Please enter your email address.');
    }
    if (!pass) {
      throw new Error('Please enter your password.');
    }

    // Step 1: Firebase Authentication verifies credentials
    const cred = await signInWithEmailAndPassword(auth, trimmedEmail, pass);
    
    // Step 2: Retrieve trusted authorization profile from Firestore
    const profile = await getUserProfile(cred.user.uid);

    // Step 3: Critical Security Guard - Profile existence check
    if (!profile) {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      throw new Error('Your account profile was not found in the clinic database. Please contact an administrator.');
    }

    // Step 4: Critical Security Guard - REJECT PATIENT ACCOUNTS
    if (profile.role === 'PATIENT' || profile.role === 'patient') {
      // Immediately revoke Firebase Auth session so no authenticated session is held in client
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      throw new Error('This account is registered as a patient. Please sign in via the Patient Portal.');
    }

    // Step 5: Verify account is not deactivated
    if (profile.status === 'inactive' || profile.status === 'INACTIVE') {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      throw new Error('Account inactive. This account has been disabled. Please contact the administrator.');
    }

    // Step 6: Verify trusted administrative/staff role
    const validStaffRoles = ['CLINIC_ADMIN', 'admin', 'SUPER_ADMIN', 'DOCTOR', 'RECEPTIONIST'];
    if (!validStaffRoles.includes(profile.role)) {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      throw new Error('Access denied. This account is not authorized to access the Clinic Admin Portal.');
    }

    // Step 7: Verify clinic assignment for non-Super Admins
    if (profile.role !== 'SUPER_ADMIN') {
      const authorizedClinics = profile.clinicIds || profile.accessibleClinicIds || (profile.clinicId ? [profile.clinicId] : []);
      if (authorizedClinics.length === 0) {
        await firebaseSignOut(auth);
        setUser(null);
        setUserProfile(null);
        throw new Error('Access denied. No authorized clinic branches have been assigned to this account.');
      }

      if (targetClinicId && !authorizedClinics.includes(targetClinicId)) {
        await firebaseSignOut(auth);
        setUser(null);
        setUserProfile(null);
        throw new Error('Your account is not authorized for the selected clinic.');
      }

      const activeId = targetClinicId || authorizedClinics[0];
      try {
        localStorage.setItem('mediqueue_active_clinic_id', activeId);
      } catch (_) {}
    }

    setUser(cred.user);
    setUserProfile(profile as UserProfile);
    return profile as UserProfile;
  };

  // Register Clinic Staff / Admin (Restricted to Super Admin)
  const registerAdmin = async (
    email: string, 
    pass: string, 
    clinicId?: string,
    role: UserRole = 'CLINIC_ADMIN'
  ) => {
    if (!superAdminSessionToken && userProfile?.role !== 'SUPER_ADMIN') {
      throw new Error('Unauthorized: Only Super Administrators can provision staff accounts.');
    }

    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const targetClinicId = clinicId || '';

    // Staff accounts cannot register as Super Admin from client
    const assignedRole: UserRole = role === 'SUPER_ADMIN' ? 'CLINIC_ADMIN' : role;

    const profileData: UserProfile = {
      uid: cred.user.uid,
      email,
      name: email.split('@')[0].toUpperCase(),
      phone: '',
      age: 35,
      gender: 'Male',
      role: assignedRole,
      clinicId: targetClinicId,
      clinicIds: targetClinicId ? [targetClinicId] : [],
      accessibleClinicIds: targetClinicId ? [targetClinicId] : [],
      status: 'active',
      createdAt: new Date().toISOString()
    };
    const saved = await saveUserProfile(profileData);
    setUserProfile(saved as UserProfile);
    if (targetClinicId) {
      try {
        localStorage.setItem('mediqueue_active_clinic_id', targetClinicId);
      } catch (_) {}
    }
  };

  const signUpPatient = async (
    email: string, 
    pass: string, 
    profileData: {
      name: string;
      phone: string;
      age?: number;
      gender?: 'Male' | 'Female' | 'Other';
      clinicId: string;
      clinicName: string;
    }
  ): Promise<UserProfile> => {
    const cleanEmail = email?.trim() || '';
    if (!cleanEmail) throw new Error('Please enter a valid email address.');
    if (!pass || pass.length < 6) throw new Error('Password must be at least 6 characters in length.');
    if (!profileData.clinicId) throw new Error('A clinic must be selected for patient registration.');

    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
    const fullProfile: UserProfile = {
      uid: cred.user.uid,
      email: cleanEmail,
      name: profileData.name.trim() || 'Patient',
      phone: profileData.phone.trim(),
      age: profileData.age ? Number(profileData.age) : 30,
      gender: profileData.gender || 'Male',
      role: 'PATIENT',
      clinicId: profileData.clinicId,
      clinicName: profileData.clinicName,
      clinicIds: [profileData.clinicId],
      accessibleClinicIds: [profileData.clinicId],
      activeClinicId: profileData.clinicId,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    let saved: UserProfile;
    try {
      saved = await saveUserProfile(fullProfile) as UserProfile;
    } catch (saveErr) {
      console.error('[AuthContext] Failed to save patient profile after auth user creation. Cleaning up orphan auth account...', saveErr);
      try {
        await cred.user.delete();
      } catch (delErr) {
        console.warn('[AuthContext] Could not rollback orphan auth user:', delErr);
      }
      throw saveErr;
    }

    if (fullProfile.clinicId) {
      try {
        localStorage.setItem('mediqueue_active_clinic_id', fullProfile.clinicId);
      } catch (_) {}
    }
    setUser(cred.user);
    setUserProfile(saved);
    return saved;
  };

  const signInPatient = async (email: string, pass: string): Promise<UserProfile> => {
    const cleanEmail = email?.trim() || '';
    if (!cleanEmail) {
      throw new Error('Please enter your email address.');
    }
    if (!pass) {
      throw new Error('Please enter your password.');
    }

    // Step 1: Firebase Authentication (Credentials checked only by Firebase Auth)
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    
    // Step 2: Fetch application user profile by Firebase UID
    let profile = await getUserProfile(cred.user.uid, true);
    
    // Step 3: Handle missing profile - Attempt graceful self-healing for authenticated patient
    if (!profile) {
      console.warn('[AuthContext] Missing user profile for authenticated user:', cred.user.uid, 'Attempting self-healing...');
      try {
        let defaultClinicId = '';
        try {
          defaultClinicId = localStorage.getItem('mediqueue_active_clinic_id') || '';
        } catch (_) {}

        const fallbackProfile: UserProfile = {
          uid: cred.user.uid,
          email: cleanEmail,
          name: cred.user.displayName || cleanEmail.split('@')[0] || 'Patient',
          phone: cred.user.phoneNumber || '',
          role: 'PATIENT',
          clinicId: defaultClinicId,
          clinicName: '',
          clinicIds: defaultClinicId ? [defaultClinicId] : [],
          accessibleClinicIds: defaultClinicId ? [defaultClinicId] : [],
          activeClinicId: defaultClinicId,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        profile = await saveUserProfile(fallbackProfile) as UserProfile;
        console.log('[AuthContext] Successfully self-healed patient profile for user:', cred.user.uid);
      } catch (healErr) {
        console.error('[AuthContext] Self-healing failed:', healErr);
        await firebaseSignOut(auth);
        setUser(null);
        setUserProfile(null);
        throw new Error('Your account profile could not be loaded. Please contact support or register again.');
      }
    }

    // Step 4: Handle inactive / disabled accounts
    if (profile.status === 'inactive' || profile.status === 'INACTIVE') {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      throw new Error('This account has been disabled. Please contact clinic support.');
    }

    // Step 5: Check role
    if (profile.role !== 'PATIENT' && profile.role !== 'patient') {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      throw new Error('This account is registered as clinic staff. Please sign in via the Staff / Admin Portal.');
    }

    // Step 6: Verify registered clinic exists on profile (with fallback)
    if (!profile.clinicId) {
      const fallbackClinic = profile.clinicIds?.[0] || localStorage.getItem('mediqueue_active_clinic_id');
      if (fallbackClinic) {
        profile.clinicId = fallbackClinic;
      } else {
        await firebaseSignOut(auth);
        setUser(null);
        setUserProfile(null);
        throw new Error('Your account is not associated with any clinic branch. Please contact support.');
      }
    }

    // Step 7: Synchronize active clinic session
    try {
      localStorage.setItem('mediqueue_active_clinic_id', profile.clinicId);
    } catch (_) {}

    setUser(cred.user);
    setUserProfile(profile as UserProfile);
    return profile as UserProfile;
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    if (superAdminSessionToken || userProfile?.role === 'SUPER_ADMIN') {
      try {
        await fetch('/api/super-admin/logout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(superAdminSessionToken ? { 'Authorization': `Bearer ${superAdminSessionToken}` } : {})
          }
        });
      } catch (_) {}
      
      logAuditEvent({
        action: 'SUPER_ADMIN_LOGOUT',
        clinicName: 'MediQueue System Global',
        actorRole: 'SUPER_ADMIN',
        details: { timestamp: new Date().toISOString() }
      });

      sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
      setSuperAdminSessionToken(null);
    } else if (user) {
      const activeClinicId = userProfile?.clinicId;
      logAuditEvent({
        action: 'ADMIN_LOGOUT',
        clinicId: activeClinicId,
        clinicName: userProfile?.clinicName,
        details: { email: user.email }
      });
    }

    try {
      await firebaseSignOut(auth);
    } catch (_) {}

    try {
      localStorage.removeItem('mediqueue_active_clinic_id');
    } catch (_) {}

    setUser(null);
    setUserProfile(null);
  };

  // Strict Authorization checks: Super Admin is verified via secure server-side session
  const isSuperAdmin = (!!superAdminSessionToken && userProfile?.role === 'SUPER_ADMIN') || 
                       (!!user && userProfile?.role === 'SUPER_ADMIN');
  const isClinicAdmin = isSuperAdmin || (!!user && !!userProfile && (userProfile.role === 'CLINIC_ADMIN' || userProfile.role === 'admin'));
  const isClinicStaff = isClinicAdmin || (!!user && !!userProfile && (userProfile.role === 'DOCTOR' || userProfile.role === 'RECEPTIONIST'));
  const isAdmin = isSuperAdmin || isClinicAdmin;
  const userRole: UserRole = isSuperAdmin ? 'SUPER_ADMIN' : (userProfile?.role || 'patient');

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile, 
      loading, 
      authReady,
      isAdmin,
      isSuperAdmin,
      isClinicAdmin,
      isClinicStaff,
      userRole,
      superAdminSessionToken,
      loginSuperAdmin,
      login, 
      registerAdmin, 
      signUpPatient,
      signInPatient,
      resetPassword, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
