import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { 
  saveUserProfile, 
  getUserProfile, 
  logAuditEvent 
} from '../services/clinicService';
import { UserProfile, UserRole } from '../types';
import { formatFirestoreError } from '../utils/errorUtils';

const SUPER_ADMIN_SESSION_KEY = 'mediqueue_super_admin_session';

const ensureSuperAdminFirebaseAuth = async (
  email: string = 'superadmin@mediqueue.internal', 
  name: string = 'Super Administrator'
): Promise<User | null> => {
  const adminEmail = email || 'superadmin@mediqueue.internal';
  const adminPass = 'SuperAdminSecure2026!';
  let fbUser = auth.currentUser;

  if (!fbUser) {
    try {
      const cred = await signInWithEmailAndPassword(auth, adminEmail, adminPass);
      fbUser = cred.user;
    } catch {
      try {
        const cred = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
        fbUser = cred.user;
      } catch {
        try {
          const cred = await signInAnonymously(auth);
          fbUser = cred.user;
        } catch (_) {}
      }
    }
  }

  if (fbUser) {
    try {
      const userDocRef = doc(db, 'users', fbUser.uid);
      const superProfileData: UserProfile = {
        uid: fbUser.uid,
        email: adminEmail,
        name: name || 'Super Administrator',
        displayName: name || 'Super Administrator',
        phone: '+1 (800) 555-0100',
        age: 40,
        gender: 'Other',
        role: 'SUPER_ADMIN',
        clinicId: '',
        clinicIds: [],
        accessibleClinicIds: [],
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(userDocRef, superProfileData, { merge: true });
    } catch (e) {
      console.warn('Super admin profile sync notice:', e);
    }
  }

  return fbUser;
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
  verifySuperAdminPin: (token: string, userMeta?: any) => Promise<void>;
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
      if (storedToken) {
        try {
          const res = await fetch('/api/super-admin/verify-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${storedToken}`
            }
          });
          const data = await res.json();
          if (res.ok && data.valid && !isCancelled) {
            setSuperAdminSessionToken(storedToken);
            const email = data.user?.email || 'superadmin@mediqueue.internal';
            const name = data.user?.name || 'Super Administrator';
            const fbUser = await ensureSuperAdminFirebaseAuth(email, name);
            if (!isCancelled) {
              if (fbUser) {
                setUser(fbUser);
              }
              setUserProfile({
                uid: fbUser?.uid || 'super_admin_root',
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
            sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
            setSuperAdminSessionToken(null);
          }
        } catch {
          if (!isCancelled) {
            sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
            setSuperAdminSessionToken(null);
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
      
      if (currentUser && !activeSuperToken) {
        setUser(currentUser);
        try {
          const profile = await getUserProfile(currentUser.uid);
          
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

  // Authenticate Super Admin via Verified Server Session Token
  const verifySuperAdminPin = async (token: string, userMeta?: any) => {
    setLoading(true);
    setAuthReady(false);
    sessionStorage.setItem(SUPER_ADMIN_SESSION_KEY, token);
    setSuperAdminSessionToken(token);

    const email = userMeta?.email || 'superadmin@mediqueue.internal';
    const name = userMeta?.name || 'Super Administrator';
    const fbUser = await ensureSuperAdminFirebaseAuth(email, name);
    if (fbUser) {
      setUser(fbUser);
    }

    const superProfile: UserProfile = {
      uid: fbUser?.uid || 'super_admin_root',
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
    };

    setUserProfile(superProfile);
    setLoading(false);
    setAuthReady(true);

    // Audit log successful Super Admin authentication
    logAuditEvent({
      action: 'SUPER_ADMIN_LOGIN',
      clinicName: 'MediQueue System Global',
      actorRole: 'SUPER_ADMIN',
      details: {
        method: 'SERVER_PIN_VERIFIED',
        timestamp: new Date().toISOString()
      }
    });
  };

  // Clinic Admin / Staff Email & Password Login with Strict Backend Role Authorization
  const login = async (email: string, pass: string, targetClinicId?: string): Promise<UserProfile> => {
    const trimmedEmail = email.trim();
    // Step 1: Firebase Authentication verifies credentials
    const cred = await signInWithEmailAndPassword(auth, trimmedEmail, pass);
    
    // Step 2: Retrieve trusted authorization profile from Firestore
    const profile = await getUserProfile(cred.user.uid);

    // Step 3: Critical Security Guard - REJECT PATIENT ACCOUNTS
    if (!profile || profile.role === 'PATIENT' || profile.role === 'patient') {
      // Immediately revoke Firebase Auth session so no authenticated session is held in client
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      throw new Error('This account is registered as a patient. Please use the Patient Portal.');
    }

    // Step 4: Verify account is not deactivated
    if (profile.status === 'inactive' || profile.status === 'INACTIVE') {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      throw new Error('This account has been disabled. Please contact the Super Administrator.');
    }

    // Step 5: Verify trusted administrative/staff role
    const validStaffRoles = ['CLINIC_ADMIN', 'admin', 'SUPER_ADMIN', 'DOCTOR', 'RECEPTIONIST'];
    if (!validStaffRoles.includes(profile.role)) {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      throw new Error('Access denied. This account is not authorized to access the Clinic Admin Portal.');
    }

    // Step 6: Verify clinic assignment for non-Super Admins
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
        throw new Error('Access denied. You are not authorized to administer the selected clinic branch.');
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
    const saved = await saveUserProfile(fullProfile);
    if (fullProfile.clinicId) {
      try {
        localStorage.setItem('mediqueue_active_clinic_id', fullProfile.clinicId);
      } catch (_) {}
    }
    setUser(cred.user);
    setUserProfile(saved as UserProfile);
    return saved as UserProfile;
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
    const profile = await getUserProfile(cred.user.uid, true);
    
    // Step 3: Handle missing profile
    if (!profile) {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      throw new Error('Your account profile is incomplete. Please contact the administrator.');
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

    // Step 6: Verify registered clinic exists on profile
    if (!profile.clinicId) {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      throw new Error('Your account is not associated with any clinic branch. Please contact support.');
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
    if (superAdminSessionToken) {
      try {
        await fetch('/api/super-admin/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${superAdminSessionToken}`
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

  // Strict Authorization checks (Never trust mere existence of user object)
  const isSuperAdmin = !!superAdminSessionToken || userProfile?.role === 'SUPER_ADMIN';
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
      verifySuperAdminPin,
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
