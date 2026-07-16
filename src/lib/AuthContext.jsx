import React, { createContext, useContext, useEffect, useState } from "react";
import { appParams } from "@/lib/app-params";

const AuthContext = createContext();
const hasInitialToken = Boolean(appParams.token);

const loadBase44 = async () => {
  const { base44 } = await import("@/api/base44Client");
  return base44;
};

const loadPublicSettings = async () => {
  const headers = {
    "X-App-Id": appParams.appId,
  };

  if (appParams.token) {
    headers.Authorization = `Bearer ${appParams.token}`;
  }

  const response = await fetch(
    `/api/apps/public/prod/public-settings/by-id/${appParams.appId}`,
    {
      credentials: "same-origin",
      headers,
    },
  );
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      data?.message || `Public settings request failed with ${response.status}`,
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(hasInitialToken);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(!hasInitialToken);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const checkUserAuth = async () => {
    if (!appParams.token) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return;
    }

    try {
      setIsLoadingAuth(true);
      const base44 = await loadBase44();
      const currentUser = await base44.auth.me();
      setUser(currentUser || null);
      setIsAuthenticated(Boolean(currentUser));
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);

      // An absent or expired session is a normal unauthenticated state for
      // public pages. Protected route guards will send the visitor to login.
      if (error.status !== 401 && error.status !== 403) {
        console.error("User auth check failed:", error);
        setAuthError({
          type: "unknown",
          message: error.message || "Failed to verify authentication",
        });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const checkAppState = async () => {
    setIsLoadingPublicSettings(true);
    setAuthError(null);

    // Public settings and an existing authenticated session are independent.
    // Run them in parallel and never hold public route rendering behind either.
    const authPromise = checkUserAuth();

    try {
      const publicSettings = await loadPublicSettings();
      setAppPublicSettings(publicSettings);
    } catch (appError) {
      console.error("App state check failed:", appError);

      if (appError.status === 403 && appError.data?.extra_data?.reason) {
        const reason = appError.data.extra_data.reason;
        if (reason === "auth_required") {
          setAuthError({
            type: "auth_required",
            message: "Authentication required",
          });
        } else if (reason === "user_not_registered") {
          setAuthError({
            type: "user_not_registered",
            message: "User not registered for this app",
          });
        } else {
          setAuthError({
            type: reason,
            message: appError.message,
          });
        }
      } else {
        setAuthError({
          type: "unknown",
          message: appError.message || "Failed to load app",
        });
      }
    } finally {
      setIsLoadingPublicSettings(false);
      await authPromise;
    }
  };

  useEffect(() => {
    void checkAppState();
  }, []);

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    const base44 = await loadBase44();

    if (shouldRedirect) {
      base44.auth.logout(window.location.href);
    } else {
      base44.auth.logout();
    }
  };

  const navigateToLogin = async (returnUrl = window.location.href) => {
    const base44 = await loadBase44();
    base44.auth.redirectToLogin(returnUrl);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
